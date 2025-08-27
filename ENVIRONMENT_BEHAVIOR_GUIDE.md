# Environment-Specific Behavior Guide

This document details all code changes that occur when switching between `NODE_ENV=development`, `NODE_ENV=test`, and `NODE_ENV=production`.

## Table of Contents
- [Main Application Configuration](#main-application-configuration)
- [Security Settings](#security-settings)
- [Email Service](#email-service)
- [Database Configuration](#database-configuration)
- [Error Handling](#error-handling)
- [Logging System](#logging-system)
- [Queue Configuration](#queue-configuration)
- [Rate Limiting](#rate-limiting)

---

## Main Application Configuration

### File: `src/main.ts`

**Lines 50-51: Environment Detection**
```typescript
const isDevelopment = configService.get<string>('env') === 'development';
const isProduction = configService.get<string>('env') === 'production';
```

**Lines 53-73: Helmet Security Headers**
```typescript
app.use(
  helmet({
    contentSecurityPolicy: isDevelopment
      ? false  // ❌ DEVELOPMENT: CSP disabled
      : {      // ✅ PRODUCTION/TEST: CSP enabled
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
            styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
            fontSrc: ["'self'", 'https://fonts.gstatic.com'],
            imgSrc: ["'self'", 'data:', 'https:'],
            connectSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'none'"],
            frameSrc: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
            frameAncestors: ["'none'"],
            ...(isProduction && { upgradeInsecureRequests: [] }), // ✅ PRODUCTION ONLY
          },
        },
    crossOriginEmbedderPolicy: !isDevelopment, // ✅ PRODUCTION/TEST: enabled
    hsts: isProduction
      ? {  // ✅ PRODUCTION: HSTS with 1 year max-age
          maxAge: 31536000,
          includeSubDomains: true,
          preload: true,
        }
      : false, // ❌ DEVELOPMENT/TEST: HSTS disabled
```

**Lines 145-157: CORS Configuration**
```typescript
const origin = isDevelopment
  ? [
      'http://localhost:3000',     // ✅ DEVELOPMENT: Allow all localhost ports
      'http://localhost:3001',
      'http://localhost:5173',
      // ... other localhost ports
    ]
  : allowedOrigins; // ✅ PRODUCTION/TEST: Only configured origins

app.enableCors({
  origin,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
```

**Lines 228-235: Validation Pipe**
```typescript
app.useGlobalPipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
    transformOptions: {
      enableImplicitConversion: true,
    },
    disableErrorMessages: isProduction, // ✅ PRODUCTION: Hide validation details
```

**Lines 280-292: Swagger Documentation**
```typescript
if (isDevelopment) {
  // ✅ DEVELOPMENT: Swagger without authentication
  const document = SwaggerModule.createDocument(app, config, options);
  SwaggerModule.setup('api-docs', app, document);
} else {
  // ✅ PRODUCTION/TEST: Swagger requires basic auth
  app.use(
    '/api-docs',
    basicAuth({
      users: { [swaggerUser]: swaggerPassword },
      challenge: true,
    }),
    // ... swagger setup
```

---

## Security Settings

### File: `src/infrastructure/config/configuration.ts`

**Lines 35-42: Environment Detection**
```typescript
const getBaseUrl = (configUrl: string | undefined, defaultUrl: string, env: string): string => {
  const baseUrl = configUrl || defaultUrl;
  // Remove port for test and production environments
  if (env === 'test' || env === 'production') {
    return baseUrl.replace(/:\d+$/, ''); // ✅ PRODUCTION/TEST: Remove port
  }
  return baseUrl; // ✅ DEVELOPMENT: Keep port
};
```

**Lines 146-178: SMTP Configuration**
```typescript
smtp: process.env.NODE_ENV === 'development'
  ? {  // ✅ DEVELOPMENT: SMTP enabled
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '1025', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER || null,
        pass: process.env.SMTP_PASSWORD || null,
      },
    }
  : {  // ❌ PRODUCTION/TEST: SMTP disabled
      host: null,
      port: null,
      secure: false,
      auth: {
        user: null,
        pass: null,
      },
    },
```

---

## Email Service

### File: `src/core/services/email.service.ts`

**Lines 110-125: Email Provider Validation**
```typescript
private validateEmailProvider(): void {
  const nodeEnv = this.configService.get<string>('env', 'development');
  const emailProvider = this.configService.get<string>('email.provider', 'resend');

  // SMTP provider restrictions
  if (emailProvider === 'smtp' || emailProvider === 'mailhog') {
    if (nodeEnv !== 'development') {
      // ❌ PRODUCTION/TEST: SMTP/MailHog not allowed
      throw new Error(
        `Email provider '${emailProvider}' is not supported in ${nodeEnv} environment. ` +
        `Only API-based providers are allowed in non-development environments.`
      );
    }
  }
}
```

**Lines 155-179: Transporter Initialization**
```typescript
private async initializeTransporter(): Promise<void> {
  const nodeEnv = this.configService.get<string>('env', 'development');
  const emailProvider = this.configService.get<string>('email.provider', 'resend');

  // SMTP initialization only in development
  if (nodeEnv === 'development' && (emailProvider === 'smtp' || emailProvider === 'mailhog')) {
    // ✅ DEVELOPMENT: Create SMTP transporter
    this.transporter = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure,
      auth: smtpConfig.auth,
    });
  } else {
    // ✅ PRODUCTION/TEST: No SMTP transporter
    this.transporter = null;
    this.logger.log('Email service initialized for production (SMTP disabled, API-based providers only)');
  }
}
```

---

## Database Configuration

### File: `src/infrastructure/database/prisma/prisma.service.ts`

**Lines 32-50: Prisma Logging Configuration**
```typescript
constructor(private readonly configService: ConfigService) {
  const prismaLogsEnabled = configService.get<boolean>('prismaLogsEnabled', false);
  
  const logConfig: Prisma.LogLevel[] = prismaLogsEnabled
    ? ['query', 'info', 'warn', 'error']  // ✅ DEVELOPMENT: All logs
    : ['error'];                           // ✅ PRODUCTION/TEST: Errors only

  super({
    log: logConfig,
    datasourceUrl: configService.get<string>('database.url'),
  });
}
```

**Lines 243-248: Database Cleanup Protection**
```typescript
async cleanDatabase(): Promise<void> {
  // Prevent accidental data deletion in production
  if (this.configService.get<string>('env') === 'production') {
    this.logger.warn('cleanDatabase called in production - operation blocked');
    return; // ✅ PRODUCTION: Block database cleanup
  }
  // ✅ DEVELOPMENT/TEST: Allow cleanup
  await this.$executeRawUnsafe('TRUNCATE TABLE ...');
}
```

---

## Error Handling

### File: `src/presentation/filters/all-exceptions.filter.ts`

**Lines 97-125: Error Message Sanitization**
```typescript
catch(exception: unknown, host: ArgumentsHost) {
  const isProduction = this.configService.get<string>('env') === 'production';
  
  // Production error sanitization
  const safeMessage = isProduction && status === 500
    ? 'An error occurred processing your request'  // ✅ PRODUCTION: Generic message
    : message;                                      // ✅ DEVELOPMENT/TEST: Actual error

  const responseBody = {
    statusCode: status,
    timestamp: new Date().toISOString(),
    path: request.url,
    message: safeMessage,
    ...(error && !isProduction && { error }),      // ❌ PRODUCTION: No error details
    ...(validationErrors && { errors: validationErrors }),
  };
}
```

### File: `src/core/utils/error-sanitization.util.ts`

**Lines 85-102: Sanitization Level by Environment**
```typescript
static getSanitizationLevelFromEnv(nodeEnv?: string): SanitizationLevel {
  const env = nodeEnv || process.env.NODE_ENV || 'production';
  
  switch (env.toLowerCase()) {
    case 'development':
    case 'local':
      return SanitizationLevel.NONE;    // ✅ DEVELOPMENT: No sanitization
    case 'test':
    case 'testing':
    case 'staging':
      return SanitizationLevel.BASIC;   // ✅ TEST: Basic sanitization
    case 'production':
    case 'prod':
    default:
      return SanitizationLevel.STRICT;  // ✅ PRODUCTION: Strict sanitization
  }
}
```

---

## Logging System

### File: `src/infrastructure/logger/logger.service.ts`

**Lines 64-71: Log Format Configuration**
```typescript
constructor(private readonly config: ConfigService) {
  this.environment = this.config.get<string>('env', 'development');
  this.apmEnabled = this.config.get<boolean>('logging.apmEnabled', false);
  
  // Format based on environment
  this.format = this.apmEnabled 
    ? 'json'  // ✅ PRODUCTION: JSON for APM systems
    : this.config.get<LogFormat>('logging.format', 'human'); // ✅ DEVELOPMENT: Human-readable
}
```

**Lines 295-315: Log Level Configuration**
```typescript
private getLogLevels(environment: string, configuredLevel: string): LogLevel[] {
  const levelHierarchy: Record<string, LogLevel[]> = {
    'verbose': ['verbose', 'debug', 'log', 'warn', 'error'],
    'debug': ['debug', 'log', 'warn', 'error'],
    'log': ['log', 'warn', 'error'],
    'warn': ['warn', 'error'],
    'error': ['error'],
    '*': ['verbose', 'debug', 'log', 'warn', 'error'], // All levels
  };

  // Override for production if needed
  if (environment === 'production' && configuredLevel === '*') {
    return ['log', 'warn', 'error']; // ✅ PRODUCTION: Reduce verbosity
  }

  return levelHierarchy[configuredLevel] || levelHierarchy['log'];
}
```

### File: `src/infrastructure/repositories/base.repository.ts`

**Lines 425-445: Error Logging with Stack Traces**
```typescript
protected logError(operation: string, error: any): void {
  const sanitizedError = this.sanitizeError(error);
  
  this.logger.error({
    message: `Repository error in ${operation}`,
    operation,
    entityType: this.entityName,
    error: sanitizedError.message,
    code: sanitizedError.code,
    ...(process.env.NODE_ENV === 'development' && {
      stack: sanitizedError.stack,  // ✅ DEVELOPMENT: Include stack trace
    }),                             // ❌ PRODUCTION: No stack trace
  });
}
```

---

## Queue Configuration

### File: `src/queues/config/queue.config.ts`

**Lines 40-85: Redis TLS Configuration**
```typescript
export const getQueueConfig = (
  configService: ConfigService,
  processType: 'api' | 'worker' = 'api',
): BullRootModuleOptions => {
  const isProd = process.env.NODE_ENV === 'production';
  const tlsEnabled = configService.get<boolean>('redis.tls', false);

  const tls = tlsEnabled
    ? {
        rejectUnauthorized: isProd ? true : false,  // ✅ PRODUCTION: Strict TLS
        checkServerIdentity: isProd                  // ❌ DEVELOPMENT: Relaxed TLS
          ? undefined 
          : () => undefined,
        servername: tlsServerName || undefined,
      }
    : undefined;

  return {
    connection: {
      host: redisHost,
      port: redisPort,
      tls,
      // ... other config
    },
  };
};
```

---

## Rate Limiting

### File: `src/presentation/guards/throttler.guard.ts`

**Lines 45-65: Throttling Bypass Logic**
```typescript
protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
  // Check if throttling is disabled for testing
  const testingMode = this.configService.get<boolean>('throttler.disableForTesting', false);
  const currentEnv = this.configService.get<string>('env', 'development');
  
  // Never skip throttling in production, regardless of configuration
  if (testingMode && currentEnv !== 'production') {
    return true;  // ✅ DEVELOPMENT/TEST: Can disable throttling
  }             // ❌ PRODUCTION: Always enforced
  
  // Check for @SkipThrottle() decorator
  const skipThrottle = this.reflector.getAllAndOverride<boolean>(SKIP_THROTTLE_KEY, [
    context.getHandler(),
    context.getClass(),
  ]);
  
  return skipThrottle ?? false;
}
```

---

## Summary Table

| Component | Development | Test | Production |
|-----------|------------|------|------------|
| **CSP Headers** | ❌ Disabled | ✅ Enabled | ✅ Enabled |
| **HSTS** | ❌ Disabled | ❌ Disabled | ✅ 1 year |
| **CORS** | 🟡 Localhost ports | 🔴 Configured only | 🔴 Configured only |
| **Error Details** | ✅ Full details | 🟡 Basic sanitization | ❌ Generic messages |
| **Stack Traces** | ✅ Included | ✅ Included | ❌ Removed |
| **SMTP Email** | ✅ Enabled | ❌ Disabled | ❌ Disabled |
| **Query Logs** | ✅ Available | ❌ Disabled | ❌ Disabled |
| **Swagger Auth** | ❌ No auth | ✅ Basic auth | ✅ Basic auth |
| **Rate Limiting** | 🟡 Can disable | 🟡 Can disable | ✅ Always on |
| **TLS Validation** | 🟡 Relaxed | 🟡 Relaxed | ✅ Strict |
| **Log Format** | 📝 Human | 📝 Human | 📊 JSON |
| **Database Cleanup** | ✅ Allowed | ✅ Allowed | ❌ Blocked |

## Environment Variables that Control Behavior

```bash
# Primary environment selector
NODE_ENV=development|test|production

# Feature flags that respect environment
THROTTLER_DISABLE_FOR_TESTING=true  # Ignored in production
PRISMA_LOGS_ENABLED=true            # Typically false in production
EMAIL_PROVIDER=smtp|mailhog|resend  # SMTP only works in development
LOGGING_FORMAT=human|json           # JSON recommended for production
SWAGGER_USER=admin                  # Required in production
SWAGGER_PASSWORD=secret             # Required in production
```

## Critical Files for Environment Configuration

1. **src/main.ts** - Main application bootstrap with security headers
2. **src/infrastructure/config/configuration.ts** - Central configuration mapping
3. **src/core/services/email.service.ts** - Email provider routing
4. **src/presentation/filters/all-exceptions.filter.ts** - Error response formatting
5. **src/queues/config/queue.config.ts** - Redis/BullMQ configuration
6. **src/infrastructure/logger/logger.service.ts** - Logging format and levels
7. **src/core/utils/error-sanitization.util.ts** - Error message sanitization
8. **src/presentation/guards/throttler.guard.ts** - Rate limiting enforcement
9. **src/infrastructure/database/prisma/prisma.service.ts** - Database logging
10. **src/infrastructure/repositories/base.repository.ts** - Repository error logging

---

## Deployment Checklist

### For TEST Environment
- [ ] Set `NODE_ENV=test`
- [ ] Configure API-based email provider (Resend)
- [ ] Set appropriate CORS origins
- [ ] Enable basic error sanitization
- [ ] Configure Redis without strict TLS

### For PRODUCTION Environment
- [ ] Set `NODE_ENV=production`
- [ ] Enable all security headers (CSP, HSTS)
- [ ] Configure strict CORS origins
- [ ] Set strong Swagger credentials
- [ ] Enable strict error sanitization
- [ ] Configure Redis with TLS
- [ ] Use JSON logging format
- [ ] Disable all debug features
- [ ] Remove all development dependencies
- [ ] Verify rate limiting is active