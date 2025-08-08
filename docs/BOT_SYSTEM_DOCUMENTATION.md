# 🤖 Sistema de Autenticación BOT - Documentación Técnica y Guía de Implementación

## 📋 Índice
1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Arquitectura del Sistema](#arquitectura-del-sistema)
3. [Modelo de Seguridad](#modelo-de-seguridad)
4. [Tutorial de Implementación](#tutorial-de-implementación)
5. [API Reference](#api-reference)
6. [Comunicación Segura](#comunicación-segura)
7. [Mantenimiento y Monitoreo](#mantenimiento-y-monitoreo)
8. [Troubleshooting](#troubleshooting)

---

## 🎯 Resumen Ejecutivo

### ¿Qué es el Sistema BOT?

El Sistema de Autenticación BOT es una solución avanzada diseñada para permitir que chatbots externos y sistemas automatizados se integren de manera segura con el backend de NestJS. Proporciona tokens JWT especializados con privilegios elevados mientras mantiene controles de seguridad estrictos.

### Características Principales

- ✅ **Autenticación Especializada**: Tokens JWT con privilegios especiales para bots
- ✅ **Seguridad Multinivel**: Permisos ocultos que no pueden ser asignados manualmente
- ✅ **Alto Rendimiento**: Validación de tokens en memoria sub-milisegundo
- ✅ **Auditoría Completa**: Registro detallado de todas las actividades del bot
- ✅ **Multi-tenancy**: Aislamiento por empresa manteniendo la seguridad
- ✅ **Revocación Inmediata**: Capacidad de deshabilitar tokens al instante

### Casos de Uso Típicos

- 🤖 Chatbots de atención al cliente
- 🔄 Sistemas de integración automática
- 📊 Herramientas de análisis y reporting automatizado
- 🔗 APIs de terceros que requieren acceso elevado

---

## ⚠️ ACLARACIÓN CRÍTICA: Seguridad vs Optimización

### 🛡️ **IMPORTANTE: Los BOTs NO Saltan Medidas de Seguridad**

**❌ MALENTENDIDO COMÚN:**
> "Los BOTs saltan medidas de seguridad con `@BotAccess()`"

**✅ REALIDAD:**
> "Los BOTs obtienen **optimizaciones de performance** manteniendo **TODA la seguridad**"

### 🔒 **Medidas de Seguridad que SIEMPRE se Aplican (BOT + Usuarios):**

| Medida de Seguridad | BOT | Usuario Regular | Descripción |
|---------------------|-----|-----------------|-------------|
| **🔐 JWT Authentication** | ✅ OBLIGATORIO | ✅ OBLIGATORIO | Validación de token siempre requerida |
| **🛡️ Role Authorization** | ✅ OBLIGATORIO | ✅ OBLIGATORIO | Verificación de roles nunca omitida |
| **🎯 Permissions Validation** | ✅ OBLIGATORIO | ✅ OBLIGATORIO | Permisos validados en cada request |
| **🏢 Multi-tenant Isolation** | ✅ OBLIGATORIO | ✅ OBLIGATORIO | Aislamiento por empresa siempre activo |
| **📝 Comprehensive Auditing** | ✅ OBLIGATORIO | ✅ OBLIGATORIO | Logs de seguridad completos |
| **🚨 Security Guards** | ✅ OBLIGATORIO | ✅ OBLIGATORIO | Todos los guards de seguridad activos |

### ⚡ **Lo ÚNICO que se Optimiza para BOTs (Solo Performance):**

| Optimización | BOT con `@BotAccess()` | BOT sin `@BotAccess()` | Usuario Regular |
|-------------|----------------------|----------------------|-----------------|
| **⏱️ Rate Limiting** | 🚫 Omitido | ✅ Aplicado | ✅ Aplicado |
| **🚦 Request Throttling** | 🚫 Omitido | ✅ Aplicado | ✅ Aplicado |
| **⚡ Processing Overhead** | 🚫 Reducido | ✅ Normal | ✅ Normal |

### 🎯 **Filosofía de Diseño:**

#### **Rate Limiting ≠ Medida de Seguridad Core**
- **🎯 Propósito del Rate Limiting**: Prevenir sobrecarga del servidor y abuso de recursos
- **🤖 BOTs son Sistemas Controlados**: No usuarios maliciosos, requieren alta concurrencia
- **🔒 Seguridad Real**: Authentication + Authorization + Permissions + Auditing

#### **Analogía del Mundo Real:**
```
🏢 Edificio Corporativo Seguro:
├── 🔐 Tarjeta de Acceso (Authentication) ← TODOS deben presentar
├── 🛡️ Verificación de Identidad (Authorization) ← TODOS deben pasar  
├── 🎯 Permisos de Área (Permissions) ← TODOS deben cumplir
├── 📝 Registro de Accesos (Auditing) ← TODOS son registrados
└── 🚪 Control de Flujo en Entrada:
    ├── 👤 Humanos: 1 persona/seg (necesario para orden)
    └── 🤖 Robots de Servicio: Sin límite (optimización operacional)
```

### 🚨 **Cuándo NO Usar `@BotAccess()`:**

#### **Endpoints que Requieren Rate Limiting Universal:**
```typescript
// ❌ NUNCA usar @BotAccess() en operaciones críticas:

@Post('send-email')        // Prevenir spam masivo
@Post('create-invoice')    // Prevenir duplicados accidentales  
@Post('charge-payment')    // Operaciones financieras críticas
@Delete('delete-company')  // Operaciones destructivas
@Post('create-user')       // Creación masiva no controlada
```

#### **Endpoints Ideales para `@BotAccess()`:**
```typescript
// ✅ Usar @BotAccess() para operaciones de lectura y chatbot:

@Get('users')             // Lectura de datos para contexto
@Get('products')          // Catálogos para recomendaciones
@Post('chat-message')     // Interacciones de chatbot
@Get('search')            // Búsquedas para asistencia
@Get('company-info')      // Información contextual
```

### 🔍 **Verificación de Seguridad - Ejemplo Práctico:**

```typescript
// Request de BOT con @BotAccess()
GET /api/users
Authorization: Bearer <bot_jwt_token>

// Proceso de Validación (TODOS los pasos son obligatorios):
✅ 1. ¿JWT token válido y no manipulado?     → SÍ (criptográficamente verificado)
✅ 2. ¿Token no está revocado?               → SÍ (verificado en cache + BD)
✅ 3. ¿Usuario BOT existe y está activo?     → SÍ (verificado en base de datos)
✅ 4. ¿Rol BOT es válido?                    → SÍ (verificado en roles collection)
✅ 5. ¿Permisos 'all:access' válidos?        → SÍ (permisos especiales verificados)
✅ 6. ¿Company isolation respetado?          → SÍ (multi-tenancy enforced)
✅ 7. ¿Endpoint permite BOT access?          → SÍ (@BotAccess() presente)
🚫 8. ¿Aplicar rate limiting?                → NO (optimización de performance)
✅ 9. ¿Registrar en audit log?               → SÍ (trazabilidad completa)
```

**Resultado Final:**
- **🛡️ Seguridad**: 100% mantenida (8 de 8 controles de seguridad aplicados)
- **⚡ Performance**: Optimizada para alto volumen (1 optimización aplicada)
- **🎛️ Control**: Granular por endpoint (desarrollador decide)

---

## 🏗️ Arquitectura del Sistema

### Componentes Principales

```mermaid
graph TB
    A[Bot Client] --> B[JWT Token]
    B --> C[BotOptimizationGuard]
    C --> D[PermissionsGuard]
    D --> E[BotAuditInterceptor]
    E --> F[Controller Endpoint]
    F --> G[Business Logic]
    
    H[BotTokenCacheService] --> C
    I[AuditLogService] --> E
    J[BotTokenProvider] --> B
```

### Stack Tecnológico

| Componente | Tecnología | Propósito |
|------------|------------|-----------|
| **Autenticación** | JWT + Cache Redis | Tokens especializados con validación rápida |
| **Autorización** | RBAC + Permisos Especiales | Control de acceso granular |
| **Auditoría** | Interceptores + Database | Trazabilidad completa |
| **Cache** | In-Memory + Redis | Validación sub-milisegundo |
| **Base de Datos** | Prisma + PostgreSQL | Persistencia y relaciones |

---

## 🔒 Modelo de Seguridad

### Arquitectura de Seguridad Multi-Capa

```
┌─────────────────────────────────────────┐
│            CAPA 1: Autenticación         │
│  • JWT Signature Validation             │
│  • BOT Token Type Check                 │
│  • Revocation Status Verification       │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│            CAPA 2: Autorización          │
│  • Hidden Permissions (all:access)      │
│  • ROOT-Only Token Generation           │
│  • Company-Scoped Access                │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│            CAPA 3: Auditoría             │
│  • Request/Response Logging              │
│  • Performance Metrics                  │
│  • Security Event Tracking              │
└─────────────────────────────────────────┘
```

### Permisos Especiales (Ocultos)

| Permiso | Descripción | Visibilidad |
|---------|-------------|-------------|
| `all:access` | Acceso completo a todos los endpoints | 🚫 Oculto de APIs |
| `system:access` | Acceso a funciones del sistema | 🚫 Oculto de APIs |
| `unlimited:access` | Sin restricciones de rate limiting | 🚫 Oculto de APIs |

> ⚠️ **IMPORTANTE**: Estos permisos NO aparecen en ninguna API estándar y NO pueden ser asignados manualmente por usuarios.

### Estructura del Token BOT

```json
{
  "sub": "bot-user-uuid",
  "email": "bot.uniquehash@nauto.internal",
  "roles": ["bot", "root"],
  "permissions": ["all:access"],
  "tokenType": "bot",
  "tokenId": "bot_1691424000_abc123def456",
  "companyId": "company-uuid",
  "iat": 1691424000,
  "jti": "session-token-id"
  // Nota: Sin campo 'exp' = token infinito
}
```

---

## 📚 Tutorial de Implementación

### Paso 1: Preparación del Entorno

#### 1.1 Variables de Entorno

Agregar al `.env`:

```bash
# BOT Configuration
BOT_TOKEN_SECRET=your-super-secret-bot-key
BOT_CACHE_TTL=3600000
BOT_AUDIT_ENABLED=true

# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/nauto_db"

# Redis Cache (opcional pero recomendado)
REDIS_URL="redis://localhost:6379"
```

#### 1.2 Ejecutar Migraciones

```bash
# Generar cliente Prisma
npm run db:generate

# Ejecutar migraciones
npm run db:migrate

# Sembrar datos iniciales (incluye permisos BOT)
npm run db:seed
```

### Paso 2: Crear Usuario BOT

#### 2.1 Endpoint de Creación

**POST** `/api/bot-management/users`

```bash
curl -X POST http://localhost:3000/api/bot-management/users \
  -H "Authorization: Bearer YOUR_ROOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "alias": "customer-service-bot",
    "companyId": "company-uuid-here",
    "password": "secure-bot-password-123"
  }'
```

**Respuesta:**
```json
{
  "id": "bot-user-uuid",
  "email": "bot.cs98f7a2b@nauto.internal",
  "alias": "customer-service-bot",
  "firstName": "Bot",
  "lastName": "User",
  "companyId": "company-uuid",
  "roles": ["bot", "root"],
  "createdAt": "2024-08-08T12:00:00Z"
}
```

### Paso 3: Generar Token BOT

#### 3.1 Endpoint de Generación

**POST** `/api/bot-management/tokens/generate`

```bash
curl -X POST http://localhost:3000/api/bot-management/tokens/generate \
  -H "Authorization: Bearer YOUR_ROOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "botAlias": "customer-service-bot",
    "password": "secure-bot-password-123"
  }'
```

**Respuesta:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": "never",
  "tokenId": "bot_1691424000_abc123def456"
}
```

### Paso 4: Configurar el Cliente BOT

#### 4.1 Ejemplo de Cliente en Node.js

```javascript
class NautoBotClient {
  constructor(baseUrl, token) {
    this.baseUrl = baseUrl;
    this.token = token;
    this.headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'NautoBot/1.0'
    };
  }

  async makeRequest(method, endpoint, data = null) {
    const config = {
      method,
      headers: this.headers,
      ...(data && { body: JSON.stringify(data) })
    };

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, config);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Bot request failed:', error);
      throw error;
    }
  }

  // Ejemplos de uso
  async getUsers() {
    return this.makeRequest('GET', '/api/users');
  }

  async createUser(userData) {
    return this.makeRequest('POST', '/api/users', userData);
  }
}

// Uso
const bot = new NautoBotClient(
  'https://api.nauto.com',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
);

const users = await bot.getUsers();
```

#### 4.2 Ejemplo de Cliente en Python

```python
import requests
import json
from typing import Optional, Dict, Any

class NautoBotClient:
    def __init__(self, base_url: str, token: str):
        self.base_url = base_url.rstrip('/')
        self.session = requests.Session()
        self.session.headers.update({
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json',
            'User-Agent': 'NautoBot/1.0'
        })

    def make_request(self, method: str, endpoint: str, data: Optional[Dict] = None) -> Dict[Any, Any]:
        url = f"{self.base_url}{endpoint}"
        
        try:
            response = self.session.request(
                method=method,
                url=url,
                json=data if data else None,
                timeout=30
            )
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Bot request failed: {e}")
            raise

    # Ejemplos de uso
    def get_users(self) -> Dict:
        return self.make_request('GET', '/api/users')

    def create_user(self, user_data: Dict) -> Dict:
        return self.make_request('POST', '/api/users', user_data)

# Uso
bot = NautoBotClient(
    base_url='https://api.nauto.com',
    token='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
)

users = bot.get_users()
```

---

## 🔌 API Reference

### Gestión de Usuarios BOT

#### Crear Usuario BOT
```http
POST /api/bot-management/users
Authorization: Bearer {ROOT_TOKEN}
```

**Request Body:**
```json
{
  "alias": "string (requerido)",
  "companyId": "uuid (requerido)", 
  "password": "string (requerido)"
}
```

#### Listar Usuarios BOT
```http
GET /api/bot-management/users
Authorization: Bearer {ROOT_TOKEN}
```

### Gestión de Tokens BOT

#### Generar Token BOT
```http
POST /api/bot-management/tokens/generate
Authorization: Bearer {ROOT_TOKEN}
```

**Request Body:**
```json
{
  "botAlias": "string (requerido)",
  "password": "string (requerido)"
}
```

#### Listar Tokens Activos
```http
GET /api/bot-management/tokens
Authorization: Bearer {ROOT_TOKEN}
```

#### Revocar Token BOT
```http
DELETE /api/bot-management/tokens/{tokenId}
Authorization: Bearer {ROOT_TOKEN}
```

### Auditoría de Actividad BOT

#### Obtener Logs de Actividad
```http
GET /api/bot-audit/activity?botAlias={alias}&startDate={date}&endDate={date}
Authorization: Bearer {ROOT_TOKEN}
```

**Query Parameters:**
- `botAlias`: string (opcional) - Filtrar por alias de bot específico
- `startDate`: ISO date (opcional) - Fecha inicio del rango
- `endDate`: ISO date (opcional) - Fecha fin del rango
- `limit`: number (opcional, default: 100) - Límite de resultados

---

## 🔐 Comunicación Segura

### Mejores Prácticas de Seguridad

#### 1. Gestión de Tokens

```bash
# ✅ CORRECTO: Almacenar en variables de entorno
export NAUTO_BOT_TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# ❌ INCORRECTO: Hardcodear en código
const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";
```

#### 2. Rotación de Tokens

```javascript
// Implementar rotación automática
class TokenManager {
  constructor(botClient) {
    this.botClient = botClient;
    this.rotationInterval = 30 * 24 * 60 * 60 * 1000; // 30 días
    this.scheduleRotation();
  }

  scheduleRotation() {
    setInterval(async () => {
      try {
        await this.rotateToken();
        console.log('Token rotated successfully');
      } catch (error) {
        console.error('Token rotation failed:', error);
        // Implementar notificación de error
      }
    }, this.rotationInterval);
  }

  async rotateToken() {
    // 1. Generar nuevo token
    const newToken = await this.generateNewToken();
    
    // 2. Actualizar configuración
    await this.updateTokenConfiguration(newToken);
    
    // 3. Revocar token anterior (después de delay)
    setTimeout(() => {
      this.revokeOldToken();
    }, 5 * 60 * 1000); // 5 minutos de gracia
  }
}
```

#### 3. Validación de Respuestas

```javascript
// Siempre validar respuestas del servidor
async function safeApiCall(botClient, endpoint, data) {
  try {
    const response = await botClient.makeRequest('POST', endpoint, data);
    
    // Validar estructura de respuesta
    if (!response || typeof response !== 'object') {
      throw new Error('Invalid response format');
    }
    
    // Validar campos esperados
    if (response.error) {
      throw new Error(`API Error: ${response.error}`);
    }
    
    return response;
  } catch (error) {
    // Log del error para debugging
    console.error(`API call failed for ${endpoint}:`, error);
    
    // Re-throw con contexto adicional
    throw new Error(`Failed to call ${endpoint}: ${error.message}`);
  }
}
```

#### 4. Rate Limiting del Cliente

```javascript
// Implementar rate limiting del lado del cliente
class RateLimitedBotClient {
  constructor(baseUrl, token, requestsPerSecond = 100) {
    this.baseClient = new NautoBotClient(baseUrl, token);
    this.requestQueue = [];
    this.lastRequest = 0;
    this.interval = 1000 / requestsPerSecond;
    
    this.processQueue();
  }

  async makeRequest(method, endpoint, data) {
    return new Promise((resolve, reject) => {
      this.requestQueue.push({ method, endpoint, data, resolve, reject });
    });
  }

  processQueue() {
    setInterval(() => {
      if (this.requestQueue.length === 0) return;
      
      const now = Date.now();
      if (now - this.lastRequest >= this.interval) {
        const { method, endpoint, data, resolve, reject } = this.requestQueue.shift();
        
        this.baseClient.makeRequest(method, endpoint, data)
          .then(resolve)
          .catch(reject);
          
        this.lastRequest = now;
      }
    }, 10); // Check every 10ms
  }
}
```

### Configuración de Red Segura

#### 1. HTTPS Obligatorio

```javascript
// Validar que siempre se use HTTPS
class SecureBotClient extends NautoBotClient {
  constructor(baseUrl, token) {
    if (!baseUrl.startsWith('https://')) {
      throw new Error('HTTPS is required for secure communication');
    }
    super(baseUrl, token);
  }
}
```

#### 2. Certificados SSL

```javascript
// Verificar certificados SSL en producción
const https = require('https');

const agent = new https.Agent({
  rejectUnauthorized: true, // Rechazar certificados inválidos
  ca: fs.readFileSync('path/to/ca-certificate.pem') // CA personalizada si aplica
});

// Usar el agente en requests
const response = await fetch(url, { agent });
```

#### 3. Timeout y Retry Logic

```javascript
class RobustBotClient extends NautoBotClient {
  async makeRequest(method, endpoint, data, retries = 3) {
    for (let i = 0; i < retries; i++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
        
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
          method,
          headers: this.headers,
          body: data ? JSON.stringify(data) : undefined,
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        
        return await response.json();
      } catch (error) {
        console.warn(`Request attempt ${i + 1} failed:`, error.message);
        
        if (i === retries - 1) throw error;
        
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000));
      }
    }
  }
}
```

---

## 📊 Mantenimiento y Monitoreo

### Monitoreo de Sistema

#### 1. Métricas Clave

```sql
-- Tokens activos por empresa
SELECT 
  c.name as company_name,
  COUNT(bt.id) as active_tokens,
  COUNT(CASE WHEN bt.created_at > NOW() - INTERVAL '30 days' THEN 1 END) as recent_tokens
FROM bot_tokens bt
JOIN companies c ON bt.company_id = c.id
WHERE bt.is_active = true
GROUP BY c.id, c.name
ORDER BY active_tokens DESC;

-- Actividad de bots en las últimas 24 horas
SELECT 
  DATE_TRUNC('hour', al.created_at) as hour,
  COUNT(*) as requests,
  COUNT(CASE WHEN al.metadata->>'statusCode' >= '400' THEN 1 END) as errors,
  AVG(CAST(REPLACE(al.metadata->>'duration', 'ms', '') AS integer)) as avg_response_time
FROM audit_logs al
WHERE al.type = 'bot' 
  AND al.created_at > NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour;
```

#### 2. Dashboard de Métricas

```javascript
// Endpoint para métricas en tiempo real
@Get('metrics')
@Roles('root')
async getBotMetrics() {
  return {
    activeTokens: await this.botTokenService.getActiveTokenCount(),
    totalRequests24h: await this.auditService.getRequestCount('24h'),
    errorRate24h: await this.auditService.getErrorRate('24h'),
    avgResponseTime: await this.auditService.getAvgResponseTime('24h'),
    topEndpoints: await this.auditService.getTopEndpoints(10),
    companiesWithBots: await this.companyService.getCompaniesWithActiveBots()
  };
}
```

#### 3. Alertas Automáticas

```javascript
// Sistema de alertas configurables
class BotAlertingSystem {
  constructor(alertConfig) {
    this.config = alertConfig;
    this.setupAlerts();
  }

  setupAlerts() {
    // Alerta por alto rate de errores
    setInterval(async () => {
      const errorRate = await this.getErrorRate('5m');
      if (errorRate > this.config.maxErrorRate) {
        await this.sendAlert('HIGH_ERROR_RATE', {
          rate: errorRate,
          threshold: this.config.maxErrorRate
        });
      }
    }, 5 * 60 * 1000); // Check every 5 minutes

    // Alerta por uso excesivo de recursos
    setInterval(async () => {
      const requestRate = await this.getRequestRate('1m');
      if (requestRate > this.config.maxRequestRate) {
        await this.sendAlert('HIGH_TRAFFIC', {
          rate: requestRate,
          threshold: this.config.maxRequestRate
        });
      }
    }, 60 * 1000); // Check every minute
  }

  async sendAlert(type, data) {
    // Implementar notificación (email, Slack, etc.)
    console.log(`🚨 ALERT [${type}]:`, data);
  }
}
```

### Mantenimiento Rutinario

#### 1. Limpieza de Logs

```sql
-- Script de limpieza semanal (ejecutar como cronjob)
-- Eliminar logs de auditoría mayores a 90 días
DELETE FROM audit_logs 
WHERE type = 'bot' 
  AND created_at < NOW() - INTERVAL '90 days';

-- Archivar tokens revocados antiguos
UPDATE bot_tokens 
SET archived_at = NOW()
WHERE is_active = false 
  AND revoked_at < NOW() - INTERVAL '30 days'
  AND archived_at IS NULL;
```

#### 2. Verificación de Integridad

```javascript
// Script de verificación semanal
async function runWeeklyHealthCheck() {
  const checks = [
    // Verificar consistencia cache-database
    async () => {
      const cacheTokens = await botTokenCache.getAllActiveTokens();
      const dbTokens = await botTokenRepository.findActive();
      
      if (cacheTokens.length !== dbTokens.length) {
        throw new Error('Cache-DB inconsistency detected');
      }
    },

    // Verificar tokens sin actividad
    async () => {
      const staleTokens = await auditService.findTokensWithoutActivity('30d');
      if (staleTokens.length > 0) {
        console.warn(`Found ${staleTokens.length} stale tokens`);
      }
    },

    // Verificar espacio en disco
    async () => {
      const diskUsage = await getDiskUsage('/var/log');
      if (diskUsage > 0.8) {
        throw new Error('High disk usage detected');
      }
    }
  ];

  for (const check of checks) {
    try {
      await check();
    } catch (error) {
      console.error('Health check failed:', error);
      // Enviar alerta crítica
    }
  }
}
```

---

## 🔧 Troubleshooting

### Problemas Comunes

#### 1. Token Inválido o Expirado

**Síntoma:**
```json
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Invalid or expired token"
}
```

**Diagnóstico:**
```bash
# Verificar si el token está revocado
curl -X GET http://localhost:3000/api/bot-management/tokens \
  -H "Authorization: Bearer YOUR_ROOT_TOKEN" | \
  grep "bot_1691424000_abc123def456"

# Verificar logs de auditoría
curl -X GET "http://localhost:3000/api/bot-audit/activity?tokenId=bot_1691424000_abc123def456" \
  -H "Authorization: Bearer YOUR_ROOT_TOKEN"
```

**Solución:**
1. Verificar que el token no haya sido revocado
2. Regenerar token si es necesario
3. Actualizar configuración del cliente

#### 2. Rate Limiting Issues

**Síntoma:**
```json
{
  "statusCode": 429,
  "message": "Too Many Requests"
}
```

**Diagnóstico:**
```javascript
// Verificar si BotOptimizationGuard está funcionando
const logs = await auditService.findBotLogs({
  tokenId: 'bot_token_id',
  action: 'throttle_check',
  startDate: new Date(Date.now() - 60 * 60 * 1000) // última hora
});
```

**Solución:**
1. Verificar que el endpoint tenga el decorador `@BotAccess()`
2. Confirmar que el token tenga `tokenType: 'bot'`
3. Revisar configuración de ThrottlerGuard

#### 3. Errores de Caché

**Síntoma:**
Tokens válidos siendo rechazados o tokens revocados siendo aceptados.

**Diagnóstico:**
```javascript
// Verificar estado del cache
const cacheStats = await botTokenCache.getStats();
console.log('Cache stats:', cacheStats);

// Forzar sincronización con BD
await botTokenCache.syncWithDatabase();
```

**Solución:**
```bash
# Reiniciar cache en caso de emergencia
curl -X POST http://localhost:3000/api/bot-management/cache/refresh \
  -H "Authorization: Bearer YOUR_ROOT_TOKEN"
```

#### 4. Problemas de Auditoría

**Síntoma:**
Logs de auditoría faltantes o incompletos.

**Diagnóstico:**
```sql
-- Verificar último log por bot
SELECT 
  bt.token_id,
  MAX(al.created_at) as last_activity,
  COUNT(al.id) as total_logs
FROM bot_tokens bt
LEFT JOIN audit_logs al ON al.metadata->>'tokenId' = bt.token_id
WHERE bt.is_active = true
GROUP BY bt.token_id
ORDER BY last_activity DESC;
```

**Solución:**
1. Verificar configuración de BotAuditInterceptor
2. Revisar logs de aplicación para errores de interceptor
3. Confirmar configuración de base de datos de auditoría

### Scripts de Emergencia

#### 1. Revocar Todos los Tokens BOT

```javascript
// Script de emergencia - usar con precaución
async function emergencyRevokeAllBotTokens(reason) {
  const activeTokens = await botTokenRepository.findActive();
  
  for (const token of activeTokens) {
    await commandBus.execute(new RevokeBotTokenCommand(
      token.tokenId,
      'system', // revoked by system
      reason
    ));
  }
  
  console.log(`Revoked ${activeTokens.length} BOT tokens`);
}
```

#### 2. Limpieza de Cache Completa

```javascript
// Limpiar y reconstruir cache desde cero
async function rebuildBotTokenCache() {
  // 1. Limpiar cache actual
  await botTokenCache.clear();
  
  // 2. Cargar todos los tokens activos desde BD
  const activeTokens = await botTokenRepository.findActive();
  
  // 3. Reconstruir cache
  for (const token of activeTokens) {
    await botTokenCache.addActiveToken(token);
  }
  
  console.log(`Cache rebuilt with ${activeTokens.length} tokens`);
}
```

---

## 📋 Checklist de Implementación

### Pre-Implementación
- [ ] Variables de entorno configuradas
- [ ] Base de datos migrada y seedeada
- [ ] Cache Redis configurado (opcional)
- [ ] Certificados SSL válidos
- [ ] Monitoreo y alertas configurados

### Durante la Implementación
- [ ] Usuario ROOT creado y funcional
- [ ] Primer usuario BOT creado exitosamente
- [ ] Token BOT generado y validado
- [ ] Cliente de prueba implementado
- [ ] Endpoints críticos probados
- [ ] Logs de auditoría funcionando

### Post-Implementación
- [ ] Documentación actualizada para el equipo
- [ ] Scripts de mantenimiento programados
- [ ] Alertas de monitoreo configuradas
- [ ] Plan de rotación de tokens establecido
- [ ] Procedimientos de emergencia documentados
- [ ] Capacitación del equipo completada

---

## 🎯 Conclusiones y Recomendaciones

### Fortalezas del Sistema

✅ **Seguridad Robusta**: Permisos ocultos que no pueden ser comprometidos  
✅ **Alto Rendimiento**: Validación sub-milisegundo para aplicaciones críticas  
✅ **Auditoría Completa**: Trazabilidad total para cumplimiento normativo  
✅ **Arquitectura Limpia**: Código mantenible siguiendo mejores prácticas  
✅ **Multi-tenancy**: Aislamiento seguro entre empresas  

### Consideraciones de Seguridad

⚠️ **Gestión de Tokens**: Los tokens BOT no expiran automáticamente  
⚠️ **Privilegios Elevados**: El permiso `all:access` es muy poderoso  
⚠️ **Dependencia de Cache**: La seguridad depende de la coherencia del cache  

### Recomendaciones

1. **Rotación Regular**: Implementar rotación automática de tokens cada 30-90 días
2. **Monitoreo Continuo**: Configurar alertas para detectar patrones anómalos
3. **Auditorías Periódicas**: Revisar mensualmente usuarios y tokens BOT activos
4. **Backup del Cache**: Implementar respaldo del cache para recuperación rápida
5. **Documentación Viva**: Mantener esta documentación actualizada con cambios

---

**Versión:** 1.0  
**Fecha:** Agosto 2024  
**Mantenido por:** Equipo de Desarrollo Backend
