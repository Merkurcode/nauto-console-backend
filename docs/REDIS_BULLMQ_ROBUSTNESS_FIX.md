# Redis & BullMQ Robustness Fix

## Problema Original

El error **"Stream isn't writeable and enableOfflineQueue options is false"** se produce cuando:

1. **Socket TCP se cierra/recicla** por timeouts de idle en NAT/ELB/Firewall
2. **BullMQ Worker usa `enableOfflineQueue: false`** (por diseño, para el blocking client)  
3. **Comando `BZPOPMIN` queda bloqueado indefinidamente** sin timeout
4. **Conexiones compartidas** entre diferentes servicios
5. **Falta de `reconnectOnError`** para manejar estados transitorios de Redis

## Soluciones Implementadas

### 1. **Configuración Robusta de Reconexión**

**Archivo:** `src/infrastructure/redis/redis-connection-factory.ts`

```typescript
// Configuración robusta base para todas las conexiones Redis
const baseConfig: RedisOptions = {
  maxRetriesPerRequest: null,         // Evita MaxRetriesPerRequestError
  enableReadyCheck: true,
  lazyConnect: false,
  keepAlive: 30000,                   // 30s keep-alive agresivo
  connectTimeout: 10000,
  commandTimeout: 15000,
  
  // Backoff agresivo de reconexión
  retryStrategy: (times) => Math.min(times * 50, 2000),
  
  // Maneja estados transitorios + "Stream isn't writeable"
  reconnectOnError: (err) => {
    const msg = err?.message || '';
    return msg.includes('READONLY') || 
           msg.includes('MOVED') || 
           msg.includes('Stream isn\'t writeable') ||  // ← CLAVE
           msg.includes('enableOfflineQueue options is false');
  }
};
```

### 2. **Conexiones Redis Dedicadas (No Compartidas)**

**Antes:** Una sola conexión Redis compartida entre BullMQ y otros servicios
**Después:** Conexiones completamente separadas

```typescript
// src/infrastructure/redis/redis.module.ts - Para storage/concurrency
export class RedisModule {
  providers: [
    {
      provide: REDIS_CLIENT,
      useFactory: (factory: RedisConnectionFactory) => {
        return factory.createConnection('storage-concurrency');  // ← Dedicada
      },
    }
  ]
}

// src/queues/config/queue.config.ts - Para BullMQ
function createBullMQRedisConnection(configService, processType) {
  return {
    // Configuración completamente separada para BullMQ
    connectionName: `bullmq-${processType}-${process.pid}`,  // ← Única
    // ... configuración robusta específica
  };
}
```

### 3. **Timeout de Bloqueo Configurable (CRÍTICO)**

**Variable de entorno nueva:**
```bash
BULLMQ_BLOCK_TIMEOUT=30  # segundos
```

**Implementación:**
```typescript
// src/queues/config/queue.config.ts
if (isWorker) {
  return {
    blockTimeout,  // ← Evita bloqueos indefinidos en BZPOPMIN
    settings: {
      stalledInterval: 30000,
      maxStalledCount: 1,
    }
  };
}
```

### 4. **Manejo Específico del Error "Stream isn't writeable"**

```typescript
// src/queues/config/queue.config.ts
reconnectOnError: (err: Error) => {
  const msg = err?.message || '';
  const shouldReconnect = msg.includes('Stream isn\'t writeable') ||  // ← TU ERROR
                         msg.includes('enableOfflineQueue options is false') ||
                         msg.includes('READONLY') ||
                         msg.includes('Connection is closed');
  
  if (shouldReconnect) {
    console.warn(`Redis reconnecting due to: ${msg}`);
    return true;
  }
  return false;
}
```

### 5. **Configuraciones Específicas por Tipo de Proceso**

**Workers (más estrictos):**
```typescript
{
  lazyConnect: false,              // Conecta inmediatamente  
  enableOfflineQueue: false,       // No buffer en RAM (por diseño BullMQ)
  commandTimeout: blockTimeout * 1000 + 5000,  // Timeout específico
  keepAlive: 30000,               // Keep-alive agresivo
  blockTimeout: 30,               // ← CLAVE: evita idle timeouts
}
```

**API (más permisivo):**
```typescript
{
  lazyConnect: true,               // Conexión lazy
  enableOfflineQueue: true,        // Puede buffer comandos
  commandTimeout: 15000,           // Timeout estándar
}
```

## Archivos Modificados

### 1. Configuración Principal
- **`src/infrastructure/config/configuration.ts`** - Agregada `queue.bullmq.blockTimeout`
- **`.env.example`** - Nueva variable `BULLMQ_BLOCK_TIMEOUT=30`

### 2. Redis Infrastructure  
- **`src/infrastructure/redis/redis.module.ts`** - Factory pattern para conexiones dedicadas
- **`src/infrastructure/redis/redis-connection-factory.ts`** - Nueva factory robusta

### 3. Queue Configuration
- **`src/queues/config/queue.config.ts`** - Configuración completamente reescrita

## Configuraciones Críticas Aplicadas

### Redis Connection Settings
| Parámetro | Antes | Después | Impacto |
|-----------|-------|---------|---------|
| `maxRetriesPerRequest` | `undefined` | `null` | Evita MaxRetriesPerRequestError |
| `keepAlive` | `60000` | `30000` | Más agresivo contra idle timeouts |
| `reconnectOnError` | ❌ Ausente | ✅ Completo | Maneja "Stream isn't writeable" |
| `retryStrategy` | `1000 + times * 2000` | `times * 50` | Reconexión más rápida |
| `blockTimeout` | ❌ Ausente | `30s` | **CRÍTICO**: Evita bloqueos indefinidos |

### BullMQ Worker Settings  
| Parámetro | Antes | Después | Impacto |
|-----------|-------|---------|---------|
| `stalledInterval` | `30000` | `30000` | ✅ OK |
| `maxStalledCount` | `3` | `1` | Recuperación más agresiva |
| `blockTimeout` | ❌ Ausente | `30` | **SOLUCIONA EL ERROR** |
| Conexiones | Compartidas | Dedicadas | Evita conflictos |

## Testing de la Solución

### 1. Variables de Entorno Requeridas
```bash
# Copia las nuevas variables a tu .env
BULLMQ_BLOCK_TIMEOUT=30

# Asegúrate de tener Redis configurado
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0
```

### 2. Comandos para Probar

```bash
# 1. Limpiar y reinstalar dependencias
npm run lint
npm run build

# 2. Ejecutar workers en modo development
npm run start:dev

# 3. Verificar logs - deberías ver:
# [bullmq-worker-xxxxx] Redis connected successfully
# [storage-concurrency] Redis connected successfully
```

### 3. Señales de que está Funcionando

**Logs esperados:**
```
[bullmq-worker-12345] Redis connected successfully
[bullmq-worker-12345] Redis ready for commands
[storage-concurrency] Redis connected successfully
```

**NO más errores como:**
```
❌ Error: Stream isn't writeable and enableOfflineQueue options is false
❌ MaxRetriesPerRequestError: Reach max retries per request
```

## Beneficios de la Solución

### 1. **Robustez**
- ✅ Manejo específico del error "Stream isn't writeable"
- ✅ Reconexión automática en todos los casos problemáticos
- ✅ Keep-alive agresivo contra idle timeouts

### 2. **Aislamiento**
- ✅ Conexiones Redis completamente separadas
- ✅ No más shared connections entre BullMQ y storage
- ✅ Identificadores únicos para debugging

### 3. **Configurabilidad**
- ✅ `blockTimeout` configurable por ambiente
- ✅ Diferentes configuraciones para API vs Workers
- ✅ Factory pattern para crear conexiones personalizadas

### 4. **Observabilidad**
- ✅ Logging detallado de conexiones y reconexiones
- ✅ Identificadores únicos por conexión
- ✅ Filtrado de errores conocidos para reducir spam

## Recomendaciones para Producción

### 1. **Load Balancer Settings**
```yaml
# Asegúrate que BULLMQ_BLOCK_TIMEOUT < idle_timeout del LB
# Ejemplo: Si tu LB tiene idle_timeout=60s, usa BULLMQ_BLOCK_TIMEOUT=30
BULLMQ_BLOCK_TIMEOUT=30  # < 60s LB timeout
```

### 2. **Redis Settings**
```conf
# redis.conf
tcp-keepalive 30          # Debe coincidir con keepAlive en ioredis
timeout 0                 # No timeout del lado del servidor  
```

### 3. **Monitoring**
```bash
# Monitorear conexiones Redis
redis-cli CLIENT LIST | grep "name=bullmq\|name=storage"

# Verificar que no hay shared connections
ps aux | grep node | wc -l  # Deberías ver múltiples procesos Redis
```

## Troubleshooting

### Si sigues viendo el error:

1. **Verifica versiones:**
   ```bash
   npm list bullmq ioredis
   # BullMQ ≥ 4.x, ioredis ≥ 5.x
   ```

2. **Revisa logs de Redis:**
   ```bash
   redis-cli MONITOR | grep BZPOPMIN
   ```

3. **Verifica configuración:**
   ```bash
   # En tu .env
   echo $BULLMQ_BLOCK_TIMEOUT  # Debería mostrar 30
   ```

4. **Debugging avanzado:**
   ```bash
   DEBUG=ioredis:* npm run start:dev
   ```

La solución implementada debería eliminar completamente el error **"Stream isn't writeable and enableOfflineQueue options is false"** en todos los escenarios.