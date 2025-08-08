# Seguridad del Rol BOT - Implementación Simplificada

## Resumen

Esta implementación crea un rol BOT con privilegios ROOT y permisos especiales **ocultos y no asignables** para chatbots externos que manejan millones de usuarios.

## Características de Seguridad

### ✅ **Control de Acceso Ultra-Restrictivo**
- Solo usuarios **ROOT** pueden generar tokens BOT
- Tokens BOT tienen permisos especiales `all:access` **OCULTOS**
- Permisos especiales **NUNCA aparecen** en listados de permisos disponibles
- **IMPOSIBLE de asignar** manualmente a usuarios

### ✅ **Permisos Especiales Ocultos**
- Permiso `all:access` solo existe en tokens BOT
- No aparece en APIs de permisos disponibles
- No es visible en interfaces de administración
- Filtrado automáticamente de listados de permisos

### ✅ **Auditoría y Monitoreo**
- Logs detallados de generación de tokens
- Tracking de uso de tokens BOT
- Alertas en logs para identificar uso anómalo

### ✅ **Revocación de Tokens**
- Tokens pueden ser revocados inmediatamente por ROOT
- Lista de tokens activos para administración
- ID único de token para tracking preciso

## Flujo de Uso Seguro

### 1. **Generación de Token BOT (Solo ROOT)**
```bash
# Usuario ROOT genera token BOT con roles [BOT, ROOT] y permiso oculto
POST /bot-management/tokens/generate
Authorization: Bearer <root_token>
{
  "botUserId": "chatbot-external-001",
  "botEmail": "chatbot@company.com",
  "companyId": "uuid-company"
}

# Respuesta:
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": "never", // Token INFINITO
  "tokenId": "bot_1691424000_abc123def456"
}
```

### 2. **Token BOT Generado Contiene:**
```json
{
  "sub": "chatbot-external-001",
  "email": "chatbot@company.com",
  "roles": ["bot", "root"],
  "permissions": ["all:access"], // ← PERMISO OCULTO
  "tokenType": "bot",
  "tokenId": "bot_1691424000_abc123def456"
}
```

### 3. **Uso del Token BOT**
```bash
# Chatbot externo usa token - ACCESO COMPLETO
GET /any-endpoint
Authorization: Bearer <bot_token>
# ↑ Pasa TODOS los guards de permisos por tener all:access
```

### 3. **Revocación de Token (Solo ROOT)**
```bash
# Revocar token específico
DELETE /bot-management/tokens/<token_id>
Authorization: Bearer <root_token>
```

## Implementación Técnica

### **Guards de Seguridad**
1. `BotOptimizationGuard` - Identifica usuarios BOT y marca requests
2. `ThrottlerGuard` - Skip throttling solo para requests BOT marcados
3. `JwtAuthGuard` - Mantiene autenticación estándar para BOTs

### **Decoradores**
- `@BotAccess()` - Marca endpoints para optimización BOT
- `@Throttle()` - Mantiene limits para usuarios no-BOT

### **Token Security**
- Expiración: NUNCA (token infinito)
- Algoritmo: JWT con secret compartido
- Payload: Include `tokenType: 'bot'` para validación
- Revocación: Solo por ROOT cuando sea necesario

## Monitoreo y Alertas

### **Métricas a Monitorear**
```typescript
// Logs automáticos generados
{
  message: 'BOT token generated',
  generatedBy: '<root_user_id>',
  botUserId: '<bot_user_id>',
  tokenId: '<unique_token_id>',
  timestamp: '2025-08-07T...'
}

{
  message: 'BOT token validated',
  tokenId: '<token_id>',
  botUserId: '<bot_user_id>',
  endpoint: 'GET /chat-api/users/context'
}
```

### **Alertas de Seguridad**
- Generación de tokens BOT fuera de horario laboral
- Uso de tokens BOT desde IPs no autorizadas
- Volumen anómalo de requests BOT
- Intentos de acceso BOT a endpoints no marcados

## Limitaciones Implementadas

### **NO Permite**
- ❌ Generación por usuarios no-ROOT
- ❌ Aparición en listados de permisos
- ❌ Asignación manual del permiso `all:access`
- ❌ Modificación de permisos en runtime

### **SÍ Permite**
- ✅ Tokens infinitos (sin expiración)
- ✅ Acceso completo a todos los endpoints
- ✅ Skip de throttling y rate limiting
- ✅ Auditoría completa de actividad
- ✅ Revocación inmediata por ROOT

## Configuración de Producción

### **Variables de Entorno**
```bash
# Token BOT configuration
BOT_TOKEN_EXPIRATION=never  # Tokens infinitos
BOT_MAX_ACTIVE_TOKENS=10
BOT_MONITORING_ENABLED=true
BOT_RATE_LIMIT_BYPASS=true
```

### **Guards Registration Order**
```typescript
// main.ts - ORDEN IMPORTANTE
app.useGlobalGuards(
  new JwtAuthGuard(reflector),
  new BotOptimizationGuard(reflector), // ← ANTES que ThrottlerGuard
  new ThrottlerGuard(reflector, throttlerService, configService),
  new PermissionsGuard(reflector, userAuthService),
  // otros guards...
);
```

## Casos de Uso Válidos

### **✅ Chatbot Externo**
- Millones de usuarios concurrentes
- Necesidad de respuesta rápida
- Endpoints específicos para conversaciones
- Auditoría de interacciones

### **✅ API Integration**
- Servicios de terceros autorizados
- Webhooks de alta frecuencia  
- Sincronización de datos masiva
- Operaciones batch

### **❌ Casos NO Válidos**
- Bypass de autenticación general
- Acceso irrestricto a todos los endpoints
- Operaciones sin auditoría
- Tokens permanentes sin control

## Mantenimiento

### **Gestión de Tokens Infinitos**
- Tokens BOT nunca expiran automáticamente
- Revocación manual por ROOT cuando sea necesario
- Monitoreo continuo de uso de tokens
- Regeneración solo si es comprometido

### **Auditoría Regular**
- Revisar logs de uso BOT mensualmente
- Verificar tokens activos vs. necesarios
- Analizar patrones de uso anómalo
- Confirmar que solo ROOT genera tokens

Esta implementación balancea las necesidades de alto rendimiento con principios de seguridad defensiva, proporcionando acceso optimizado sin comprometer la integridad del sistema.