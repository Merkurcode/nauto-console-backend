# 🔐 Guía de Validación de Firmas de Peticiones (Request Signature Validation)

## Resumen Ejecutivo

El sistema implementa un middleware de validación de firmas HMAC-SHA256 para garantizar la integridad y autenticidad de todas las peticiones HTTP. Esto previene ataques man-in-the-middle, replay attacks, y manipulación de datos en tránsito.

## 🛡️ Funcionamiento del Sistema

### **1. Activación del Sistema**
El middleware se activa mediante la variable de entorno:
```bash
REQUEST_INTEGRITY_ENABLED=true  # Activar en producción
REQUEST_INTEGRITY_ENABLED=false # Desactivar en desarrollo
```

### **2. Rutas Excluidas (Sin Validación)**
Estas rutas **NO** requieren firma de validación:
```javascript
const SKIP_PATHS = [
  '/api/health',
  '/api/auth/login',
  '/api/auth/verify-otp', 
  '/api/auth/refresh-token',
  '/api/companies/by-host',
  '/docs',
  '/swagger'
];
```

### **3. Headers Requeridos**
Toda petición validada debe incluir estos headers:

| Header | Descripción | Formato | Ejemplo |
|--------|-------------|---------|---------|
| `x-signature` | Firma HMAC-SHA256 | `sha256=<hash_hex>` | `sha256=a1b2c3d4...` |
| `x-timestamp` | Timestamp Unix | Número entero | `1640995200` |
| `x-request-id` | ID único de petición | Alfanumérico | `req_1640995200_abc123` |

## 🔧 Implementación Frontend

### **Paso 1: Datos para la Firma**
El string a firmar se construye concatenando estos elementos con `\n`:

```javascript
const dataToSign = [
  method,           // 'GET', 'POST', 'PUT', etc.
  path,            // '/api/users/123?include=profile'
  rawBody,         // JSON string del body (vacío para GET)
  timestamp,       // Timestamp Unix como string
  contentType,     // 'application/json' o ''
  contentLength,   // Longitud del body como string
  contentEncoding, // Siempre 'identity'
  authorization,   // 'Bearer <token>' o ''
  requestId,       // ID único generado
  host            // 'api.ejemplo.com' (sin puerto)
].join('\n');
```

### **Paso 2: Generación de la Firma**
```javascript
// Ejemplo usando Web Crypto API (navegador)
async function generateSignature(dataToSign, secret) {
  const encoder = new TextEncoder();
  const data = encoder.encode(dataToSign);
  const keyData = encoder.encode(secret);
  
  const key = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', key, data);
  const hexSignature = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
    
  return 'sha256=' + hexSignature;
}
```

### **Paso 3: Ejemplo de Implementación Completa**
```javascript
class ApiClient {
  constructor(baseURL, secret) {
    this.baseURL = baseURL;
    this.secret = secret;
  }
  
  async makeRequest(method, path, body = null, headers = {}) {
    const timestamp = Math.floor(Date.now() / 1000);
    const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 8)}`;
    const url = new URL(path, this.baseURL);
    
    // Preparar datos
    const rawBody = body ? JSON.stringify(body) : '';
    const contentType = body ? 'application/json' : '';
    const contentLength = rawBody.length.toString();
    const contentEncoding = 'identity';
    const authorization = headers.authorization || '';
    const host = url.host.toLowerCase();
    
    // Construir string a firmar
    const dataToSign = [
      method.toUpperCase(),
      url.pathname + url.search,
      rawBody,
      timestamp.toString(),
      contentType,
      contentLength,
      contentEncoding,
      authorization,
      requestId,
      host
    ].join('\n');
    
    // Generar firma
    const signature = await this.generateSignature(dataToSign, this.secret);
    
    // Configurar headers finales
    const finalHeaders = {
      ...headers,
      'x-signature': signature,
      'x-timestamp': timestamp.toString(),
      'x-request-id': requestId,
      'Content-Type': contentType
    };
    
    // Realizar petición
    const response = await fetch(url.toString(), {
      method: method.toUpperCase(),
      headers: finalHeaders,
      body: rawBody || undefined
    });
    
    return response;
  }
  
  async generateSignature(dataToSign, secret) {
    // Implementación del Paso 2
    const encoder = new TextEncoder();
    const data = encoder.encode(dataToSign);
    const keyData = encoder.encode(secret);
    
    const key = await crypto.subtle.importKey(
      'raw', keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false, ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', key, data);
    const hexSignature = Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
      
    return 'sha256=' + hexSignature;
  }
}

// Uso
const client = new ApiClient('https://api.ejemplo.com', 'tu_secret_key');
const response = await client.makeRequest('POST', '/api/users', {
  name: 'Juan',
  email: 'juan@ejemplo.com'
}, {
  authorization: 'Bearer tu_jwt_token'
});
```

## 🔑 Configuración de Secretos

### **Variables de Entorno Requeridas**
```bash
# Habilitar/deshabilitar validación
REQUEST_INTEGRITY_ENABLED=true

# Secretos para firma (mínimo 32 caracteres)
SERVER_INTEGRITY_SECRET=tu_server_secret_muy_largo_y_seguro_aqui
BOT_INTEGRITY_SECRET=tu_bot_secret_muy_largo_y_seguro_aqui

# Configuración de timestamp
SIGNATURE_TIMESTAMP_SKEW_SECONDS=30  # Ventana de tolerancia

# Logs de debugging
SIGNATURE_VALIDATION_LOGS=false  # Solo para desarrollo

# Límite de contenido
REQUEST_MAX_CONTENT_LENGTH=10485760  # 10MB máximo
```

### **Selección de Secret**
El sistema determina qué secret usar basado en el JWT:

1. **Sin JWT**: Usa `SERVER_INTEGRITY_SECRET`
2. **JWT con `role` que contiene "bot"**: Usa `BOT_INTEGRITY_SECRET`  
3. **JWT válido**: Usa `SERVER_INTEGRITY_SECRET`
4. **JWT inválido**: Rechaza la petición

## 🚫 Casos Especiales

### **1. Subida de Archivos (Multipart)**
Para peticiones `multipart/form-data`, el `rawBody` se excluye de la firma por rendimiento:
```javascript
const isFileUpload = contentType.includes('multipart/form-data');
const rawBody = isFileUpload ? '' : actualBody;
```

### **2. Validaciones de Seguridad**
- **Content-Encoding**: Solo se permite `identity` (sin compresión)
- **Content-Length**: Máximo 10MB (configurable)
- **Timestamp**: Ventana de ±30 segundos (configurable)
- **Request-ID**: Solo caracteres alfanuméricos, máximo 100 chars

### **3. Rate Limiting y CORS**
El middleware respeta las configuraciones de CORS y rate limiting existentes.

## 🐛 Debugging y Troubleshooting

### **Habilitar Logs Detallados**
```bash
SIGNATURE_VALIDATION_LOGS=true
```

### **Errores Comunes**

| Error | Causa | Solución |
|-------|--------|----------|
| `Signature not found` | Falta header `x-signature` | Agregar header con formato `sha256=<hash>` |
| `x-timestamp is required` | Falta header `x-timestamp` | Agregar timestamp Unix actual |
| `Timestamp out of range` | Timestamp muy viejo/futuro | Sincronizar reloj del cliente |
| `Invalid signature` | Firma incorrecta | Verificar construcción del string y secret |
| `Content-Encoding rejected` | Datos comprimidos | No comprimir datos, usar `identity` |

### **Verificación Paso a Paso**
1. **Verificar rutas excluidas**: ¿La ruta necesita firma?
2. **Validar headers**: ¿Están todos los headers requeridos?
3. **Revisar timestamp**: ¿Está dentro de la ventana permitida?
4. **Construir string**: ¿El orden y formato son correctos?
5. **Verificar secret**: ¿Se está usando el secret correcto?
6. **Generar firma**: ¿El algoritmo HMAC-SHA256 es correcto?

## 📋 Ejemplo de String a Firmar

```
POST
/api/users?include=profile
{"name":"Juan","email":"juan@ejemplo.com"}
1640995200
application/json
42
identity
Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
req_1640995200_abc123
api.ejemplo.com
```

## 🔒 Consideraciones de Seguridad

1. **Secretos**: Mínimo 32 caracteres, almacenar de forma segura
2. **HTTPS**: Siempre usar HTTPS en producción
3. **Timestamp**: Ventana pequeña para prevenir replay attacks
4. **Request ID**: Único por petición, previene duplicaciones
5. **Content-Length**: Validar para prevenir ataques DoS
6. **Host**: Incluido para prevenir ataques de host header injection

## 📚 Referencias Técnicas

- **Algoritmo**: HMAC-SHA256
- **Formato de Firma**: `sha256=<hex_hash>`
- **Timestamp**: Unix timestamp en segundos
- **Encoding**: UTF-8 para todos los strings
- **Headers**: Case-insensitive según HTTP estándar

Este documento debe ser suficiente para que el equipo frontend implemente correctamente la validación de firmas de peticiones.