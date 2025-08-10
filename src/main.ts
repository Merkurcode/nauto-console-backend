import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AllExceptionsFilter } from '@presentation/filters/all-exceptions.filter';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as basicAuth from 'express-basic-auth';
import helmet from 'helmet';
import { LoggerService } from '@infrastructure/logger/logger.service';
import { useContainer } from 'class-validator';
import { join } from 'path';
import { ValidateSignatureMiddleware } from '@presentation/middleware/validate-signature.middleware';
import { JwtService } from '@nestjs/jwt';
import { REQUEST_INTEGRITY_SKIP_PATHS as _REQUEST_INTEGRITY_SKIP_PATHS } from '@shared/constants/paths';

async function bootstrap() {
  // =========================================================================
  // MEMORY CONFIGURATION (must be set before app creation)
  // =========================================================================
  const maxOldSpaceSize = process.env.NODE_MAX_OLD_SPACE_SIZE;
  const maxSemiSpaceSize = process.env.NODE_MAX_SEMI_SPACE_SIZE;

  // SECURITY: Only log memory configuration in development
  if (process.env.NODE_ENV === 'development') {
    if (maxOldSpaceSize) {
      console.warn(`Memory limit configured: ${maxOldSpaceSize}MB max heap`);
    }
    if (maxSemiSpaceSize) {
      console.warn(`Semi space configured: ${maxSemiSpaceSize}MB`);
    }
  }

  // =========================================================================
  // APPLICATION SETUP
  // =========================================================================
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);
  const logger = await app.resolve(LoggerService);

  logger.setContext('Application');

  // Enable class-validator to use NestJS dependency injection
  useContainer(app.select(AppModule), { fallbackOnErrors: true });

  // =========================================================================
  // STATIC FILES AND DYNAMIC CONFIG (BEFORE MIDDLEWARE)
  // =========================================================================
  // Serve static files from public directory BEFORE signature middleware
  app.useStaticAssets(join(__dirname, '..', 'public'), {
    setHeaders: (res, path) => {
      if (path.endsWith('.js')) {
        res.setHeader('Content-Type', 'text/javascript');
      }
    },
  });

  // =========================================================================
  // REQUEST SIGNATURE VALIDATION MIDDLEWARE
  // =========================================================================
  // Configurar middleware de validación de firma DESPUÉS de archivos estáticos
  const jwtService = app.get(JwtService);
  const validateSignatureMiddleware = new ValidateSignatureMiddleware(configService, jwtService);
  app.use(validateSignatureMiddleware.use.bind(validateSignatureMiddleware));

  // =========================================================================
  // SECURITY MIDDLEWARE - Enhanced Security Headers
  // =========================================================================
  const isDevelopment = process.env.NODE_ENV === 'development';
  const isProduction = process.env.NODE_ENV === 'production';

  app.use(
    helmet({
      contentSecurityPolicy: isDevelopment
        ? false
        : {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Required for Swagger
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
              upgradeInsecureRequests: isProduction ? [] : undefined,
            },
          },
      crossOriginEmbedderPolicy: !isDevelopment,
      hsts: isProduction
        ? {
            maxAge: 31536000, // 1 year
            includeSubDomains: true,
            preload: true,
          }
        : false,
      noSniff: true,
      originAgentCluster: true,
      dnsPrefetchControl: { allow: false },
      frameguard: { action: 'deny' },
      hidePoweredBy: true,
      ieNoOpen: true,
      permittedCrossDomainPolicies: false,
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      xssFilter: true,
    }),
  );

  // Additional security headers
  app.use((req, res, next) => {
    // Permissions Policy (formerly Feature Policy)
    res.setHeader(
      'Permissions-Policy',
      'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()',
    );

    // Additional CORS security
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');

    // Cache control for sensitive endpoints
    if (req.path.includes('/api/auth') || req.path.includes('/api/users')) {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }

    // Expect-CT for certificate transparency (production only)
    if (isProduction) {
      res.setHeader('Expect-CT', 'max-age=86400, enforce');
    }

    next();
  });

  // =========================================================================
  // CUSTOM MIDDLEWARE - ORDERED BY PRIORITY FOR PERFORMANCE & SECURITY
  // =========================================================================

  // 1. HTTPS enforcement for production (first for security)
  if (isProduction) {
    app.use((req, res, next) => {
      // Multiple ways to detect HTTPS for different proxy configurations
      const isSecure =
        req.secure || // Express built-in
        req.headers['x-forwarded-proto'] === 'https' || // Standard proxy header
        req.headers['x-forwarded-ssl'] === 'on' || // Some load balancers
        req.headers['x-scheme'] === 'https' || // Alternative header
        req.connection?.encrypted || // Direct TLS connection
        req.socket?.encrypted; // Alternative socket check

      if (!isSecure) {
        // Validate host header to prevent host header injection
        const host = req.headers.host;
        if (!host || !/^[a-zA-Z0-9.-]+$/.test(host)) {
          return res.status(400).json({
            statusCode: 400,
            message: 'Invalid host header',
            error: 'Bad Request',
          });
        }

        // Redirect to HTTPS with sanitized host
        const httpsUrl = `https://${host}${req.url}`;

        // Set security headers for redirect
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

        return res.redirect(301, httpsUrl);
      }

      next();
    });
  }

  // Handle ngrok and preflight requests
  app.use((req, res, next) => {
    // Handle ngrok browser warning
    if (req.headers['ngrok-skip-browser-warning']) {
      res.setHeader('ngrok-skip-browser-warning', 'true');
    }

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Content-Type, Authorization, Accept-Language, X-Tenant-ID, ngrok-skip-browser-warning, x-idempotency-key',
      );
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Max-Age', '86400');

      return res.status(200).end();
    }

    next();
  });

  // =========================================================================
  // GLOBAL PIPES AND FILTERS
  // =========================================================================
  // Global validation pipe with enhanced security
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Strip properties that don't have decorators
      forbidNonWhitelisted: true, // Throw error if non-whitelisted properties exist
      transform: true, // Transform payloads to DTO instances
      transformOptions: {
        enableImplicitConversion: false, // Require explicit type conversion
      },
      disableErrorMessages: isProduction, // Hide detailed errors in production
      validationError: {
        target: false, // Don't expose target object in errors
        value: false, // Don't expose values in errors
      },
      stopAtFirstError: false, // Validate all fields
      forbidUnknownValues: true, // Reject unknown values
      skipMissingProperties: false, // Validate all required properties
      skipNullProperties: false, // Validate null values
      skipUndefinedProperties: false, // Validate undefined values
    }),
  );

  // Global exception filter
  const exceptionLogger = await app.resolve(LoggerService);
  app.useGlobalFilters(new AllExceptionsFilter(exceptionLogger));

  // =========================================================================
  // CORS CONFIGURATION
  // =========================================================================
  const allowedOrigins = configService.get<string[]>('cors.allowedOrigins') || [
    'http://localhost:3000',
  ];

  // SECURITY: Strict CORS policy - never allow all origins
  const corsOptions = {
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // Allow requests with no origin (like mobile apps or Postman)
      if (!origin) {
        return callback(null, true);
      }

      // Check if origin is in allowed list
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // In development, allow localhost with any port
      if (configService.get<string>('env') === 'development' && origin.includes('localhost')) {
        return callback(null, true);
      }

      // Reject all other origins
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept-Language',
      'X-Tenant-ID',
      'X-Forwarded-For',
      'X-Real-IP',
      'ngrok-skip-browser-warning',
      // Idempotency header
      'x-idempotency-key',
    ],
    optionsSuccessStatus: 200,
  };

  app.enableCors(corsOptions);

  // =========================================================================
  // API CONFIGURATION
  // =========================================================================
  app.setGlobalPrefix('api');

  // =========================================================================
  // SWAGGER DOCUMENTATION SETUP
  // =========================================================================
  // Get i18n service configuration
  const i18nService = app.get(ConfigService).get('i18n');
  const supportedLanguages = i18nService?.supportedLocales || ['en', 'ar'];

  // Swagger document configuration
  const config = new DocumentBuilder()
    .setTitle(`${configService.get<string>('APP_NAME', 'API')} API`)
    .setDescription('Documentation.')
    .setVersion(configService.get<string>('API_VERSION', '1.0'))
    .addTag('auth', 'Authentication endpoints')
    .addTag('users', 'User management endpoints')
    .addTag('roles', 'Role management endpoints')
    .addTag('companies', 'Company management endpoints (Multi-Tenant)')
    .addTag('root', 'Root endpoints')
    .addGlobalParameters({
      name: 'Accept-Language',
      in: 'header',
      required: false,
      schema: {
        type: 'string',
        default: 'en',
        enum: supportedLanguages,
        example: 'en',
        description: 'Language preference for the response',
      },
    })
    .addGlobalParameters({
      name: 'X-Tenant-ID',
      in: 'header',
      required: false,
      schema: {
        type: 'string',
        format: 'uuid',
        example: '550e8400-e29b-41d4-a716-446655440000',
        description: 'Tenant ID for multi-tenant operations (optional, usually extracted from JWT)',
      },
    })
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token (includes tenantId for multi-tenant operations)',
        in: 'header',
      },
      'JWT-auth', // Key used in @ApiBearerAuth() decorator
    )
    .build();

  // Basic Auth for Swagger in production
  if (configService.get<string>('env') === 'production') {
    app.use(
      '/docs',
      basicAuth({
        challenge: true,
        users: {
          [configService.get<string>('swagger.user', 'admin')]: configService.get<string>(
            'swagger.password',
            'admin',
          ),
        },
      }),
    );
  }

  // Create and setup Swagger document
  const document = SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      docExpansion: 'none',
      filter: true,
      showRequestHeaders: true,
      tryItOutEnabled: true,
      requestInterceptor: async request => {
        // Load configuration from localStorage
        const SERVER_SECRET = localStorage.getItem('swagger-server-secret') || '';
        const BOT_SECRET = localStorage.getItem('swagger-bot-secret') || '';
        const secretType = localStorage.getItem('swagger-secret-type') || 'server';

        // Skip paths that don't need signature
        const SKIP_PATHS = [
          '/api/health',
          '/api/auth/login',
          '/api/auth/verify-otp',
          '/api/auth/refresh-token',
          '/api/companies/by-host',
          '/docs',
          '/swagger',
        ];

        function getPathFromUrl(url) {
          try {
            if (url.startsWith('http://') || url.startsWith('https://')) {
              const urlObj = new URL(url);

              return urlObj.pathname + urlObj.search;
            }

            return url;
          } catch (_e) {
            return url;
          }
        }

        const path = getPathFromUrl(request.url);
        const shouldSkip = SKIP_PATHS.some(skipPath => path.startsWith(skipPath));

        if (!shouldSkip && secretType !== 'none') {
          const secret = secretType === 'bot' ? BOT_SECRET : SERVER_SECRET;

          if (secret) {
            // Complete signature implementation matching middleware
            const timestamp = Math.floor(Date.now() / 1000);
            const requestId = 'req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8);
            const method = (request.method || 'GET').toUpperCase();

            // Process body consistently with middleware
            let rawBody = '';
            if (request.body) {
              if (typeof request.body === 'string') {
                rawBody = request.body;
              } else if (typeof request.body === 'object') {
                rawBody = JSON.stringify(request.body);
              }
            }

            // Set headers
            request.headers = request.headers || {};
            request.headers['x-request-id'] = requestId;
            request.headers['x-timestamp'] = timestamp.toString();

            // Get header values for signature
            const contentType = request.headers['content-type'] || '';
            const contentLength = rawBody.length.toString();
            const contentEncoding = 'identity';
            // Try multiple ways to get authorization header
            let authorization =
              request.headers['authorization'] || request.headers['Authorization'] || '';

            // If no auth header found, try to get it from Swagger UI context
            if (!authorization) {
              // Try to access Swagger UI's auth token from various possible locations
              try {
                // Check if there's auth info in the current page context
                const authData = JSON.parse(localStorage.getItem('swagger-ui-auth') || '{}');
                if (authData.authorized && authData.authorized.bearerAuth) {
                  authorization = 'Bearer ' + authData.authorized.bearerAuth.value;
                } else if (authData.token) {
                  authorization = 'Bearer ' + authData.token;
                }
              } catch (_e) {
                // Silently handle auth parsing error
              }
            }
            const host = window.location.host.toLowerCase();

            // Build dataToSign exactly as middleware does
            const dataToSign = [
              method,
              path,
              rawBody,
              timestamp.toString(),
              contentType,
              contentLength,
              contentEncoding,
              authorization,
              requestId,
              host,
            ].join('\n');

            // Generate HMAC-SHA256 signature (await properly)
            try {
              const encoder = new TextEncoder();
              const data = encoder.encode(dataToSign);
              const keyData = encoder.encode(secret);

              const key = await crypto.subtle.importKey(
                'raw',
                keyData,
                { name: 'HMAC', hash: 'SHA-256' },
                false,
                ['sign'],
              );

              const signature = await crypto.subtle.sign('HMAC', key, data);
              const hexSignature = Array.from(new Uint8Array(signature))
                .map(b => b.toString(16).padStart(2, '0'))
                .join('');

              request.headers['x-signature'] = 'sha256=' + hexSignature;
            } catch (_error) {
              // Silently fail signature generation
            }
          }
        }

        return request;
      },
    },
    customSiteTitle: `${configService.get<string>('APP_NAME', 'Clean Architecture API')} - Clean Architecture API`,

    // =========================================================================
    // CUSTOM DARK THEME CSS (Supabase Style)
    // =========================================================================
    customCss: `
      /* ===== FONTS AND BASE STYLES ===== */
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
      
      /* Hide default topbar */
      .swagger-ui .topbar { 
        display: none !important; 
      }
      
      /* Base background fix for full page */
      html, body {
        background: #0f1419 !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      
      /* Main Swagger container */
      .swagger-ui {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif !important;
        background: #0f1419 !important;
        color: #e2e8f0 !important;
        min-height: 100vh !important;
      }
      
      /* ===== HEADER AND INFO SECTION ===== */
      .swagger-ui .info {
        margin: 50px 0;
        padding: 0;
      }
      
      /* Main title - Supabase green */
      .swagger-ui .info .title {
        color: #3ecf8e !important;
        font-size: 36px !important;
        font-weight: 700 !important;
        margin-bottom: 16px !important;
      }
      
      /* Description text */
      .swagger-ui .info .description {
        color: #d1d5db !important;
        font-size: 16px !important;
        line-height: 1.6 !important;
        margin: 20px 0 !important;
      }
      
      /* Version badge - clean white text */
      .swagger-ui .info .version {
        background: transparent !important;
        color: #ffffff !important;
        font-weight: 600 !important;
        padding: 4px 12px !important;
        border-radius: 20px !important;
        font-size: 12px !important;
        margin-left: 0px !important;
        margin-right: 0 !important;
      }
      
      /* ===== LAYOUT AND WRAPPER ===== */
      .swagger-ui .wrapper {
        max-width: 1200px;
        margin: 0 auto;
        padding: 0 24px;
      }

      .swagger-ui .info .title small {
        margin-left: 20px !important;
      }
      
      /* ===== TAG SECTIONS ===== */
      /* Tag headers - Supabase green with underline */
      .swagger-ui .opblock-tag {
        color: #3ecf8e !important;
        font-size: 24px !important;
        font-weight: 700 !important;
        margin: 32px 0 16px 0 !important;
        border-bottom: 2px solid #3ecf8e !important;
        padding-bottom: 8px !important;
      }
      
      .swagger-ui .opblock-tag small {
        color: #94a3b8 !important;
        font-size: 14px !important;
        font-weight: 400 !important;
        margin-left: 12px !important;
      }
      
      .swagger-ui .opblock-tag a {
        color: #3ecf8e !important;
      }
      
      .swagger-ui .opblock-tag a:hover {
        color: #2dd4bf !important;
      }
      
      /* ===== OPERATION BLOCKS ===== */
      .swagger-ui .opblock {
        background: #1f2937 !important;
        border: 1px solid #374151 !important;
        border-radius: 8px !important;
        margin-bottom: 16px !important;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1) !important;
        transition: all 0.2s ease !important;
      }
      
      .swagger-ui .opblock:hover {
        border-color: #4a5568 !important;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1) !important;
      }
      
      /* Operation summaries */
      .swagger-ui .opblock .opblock-summary {
        background: transparent !important;
        border: none !important;
        padding: 5px 5px !important;
        cursor: pointer !important;
      }
      
      .swagger-ui .opblock.is-open .opblock-summary {
        border-bottom: 1px solid #374151 !important;
      }
      
      /* ===== HTTP METHOD BADGES ===== */
      .swagger-ui .opblock .opblock-summary-method {
        border-radius: 6px !important;
        font-weight: 600 !important;
        font-size: 12px !important;
        text-transform: uppercase !important;
        padding: 4px 8px !important;
        min-width: 64px !important;
        text-align: center !important;
      }
      
      /* HTTP method colors */
      .swagger-ui .opblock.opblock-get .opblock-summary-method {
        background: #10b981 !important;
        color: white !important;
      }
      
      .swagger-ui .opblock.opblock-post .opblock-summary-method {
        background: #3b82f6 !important;
        color: white !important;
      }
      
      .swagger-ui .opblock.opblock-put .opblock-summary-method {
        background: #f59e0b !important;
        color: white !important;
      }
      
      .swagger-ui .opblock.opblock-delete .opblock-summary-method {
        background: #ef4444 !important;
        color: white !important;
      }
      
      .swagger-ui .opblock.opblock-patch .opblock-summary-method {
        background: #8b5cf6 !important;
        color: white !important;
      }
      
      /* ===== OPERATION CONTENT ===== */
      /* Summary path and description - COPYABLE */
      .swagger-ui .opblock .opblock-summary-path {
        color: #e2e8f0 !important;
        font-weight: 500 !important;
        font-size: 16px !important;
        margin-left: 12px !important;
        user-select: text !important;
        cursor: text !important;
        font-family: 'JetBrains Mono', 'Fira Code', Consolas, monospace !important;
        padding: 8px !important;
      }
      
      /* Make all path-related elements copyable */
      .swagger-ui .opblock .opblock-summary-path span,
      .swagger-ui .opblock .opblock-summary-path a,
      .swagger-ui .opblock .opblock-summary-path code {
        user-select: text !important;
        cursor: text !important;
      }
      
      .swagger-ui .opblock .opblock-summary-description {
        color: #94a3b8 !important;
        font-size: 14px !important;
        margin-left: auto !important;
      }
      
      /* Operation body */
      .swagger-ui .opblock-body {
        background: transparent !important;
        padding: 20px !important;
      }
      
      /* ===== PARAMETERS AND RESPONSES SECTIONS ===== */
      .swagger-ui .opblock-section {
        background: transparent !important;
      }
      
      .swagger-ui .opblock-section-header {
        background: #111827 !important;
        color: #f3f4f6 !important;
        border-bottom: 1px solid #374151 !important;
        padding: 12px 16px !important;
        font-weight: 600 !important;
        font-size: 14px !important;
        text-transform: uppercase !important;
        letter-spacing: 0.5px !important;
      }
      
      .swagger-ui .opblock-section-header h4 {
        color: #f3f4f6 !important;
        margin: 0 !important;
        font-size: 14px !important;
      }
      
      .swagger-ui .opblock-section-body {
        background: transparent !important;
        padding: 0 !important;
      }
      
      /* Parameters container */
      .swagger-ui .parameters-container,
      .swagger-ui .parameters {
        background: transparent !important;
        padding: 0 !important;
      }
      
      /* Responses containers */
      .swagger-ui .responses-wrapper,
      .swagger-ui .responses,
      .swagger-ui .response {
        background: transparent !important;
      }
      
      /* ===== TABLES ===== */
      .swagger-ui .table-container {
        background: #111827 !important;
        border-radius: 6px !important;
        border: 1px solid #374151 !important;
        overflow: hidden !important;
      }
      
      .swagger-ui table thead tr td,
      .swagger-ui table thead tr th {
        background: #1f2937 !important;
        color: #f9fafb !important;
        font-weight: 600 !important;
        border-bottom: 1px solid #374151 !important;
        padding: 12px 16px !important;
      }
      
      .swagger-ui table tbody tr td {
        background: #111827 !important;
        color: #e5e7eb !important;
        border-bottom: 1px solid #374151 !important;
        padding: 12px 16px !important;
        vertical-align: top !important;
      }
      
      /* ===== BUTTONS ===== */
      .swagger-ui .btn {
        border-radius: 6px !important;
        font-weight: 500 !important;
        font-size: 14px !important;
        padding: 8px 16px !important;
        transition: all 0.2s ease !important;
        border-width: 1px !important;
        cursor: pointer !important;
      }
      
      /* Execute button */
      .swagger-ui .btn.execute {
        background: #3b82f6 !important;
        color: white !important;
        border-color: #3b82f6 !important;
      }
      
      .swagger-ui .btn.execute:hover {
        background: #2563eb !important;
        border-color: #2563eb !important;
      }
      
      /* Cancel button */
      .swagger-ui .btn.cancel {
        background: transparent !important;
        color: #94a3b8 !important;
        border-color: #4b5563 !important;
      }
      
      .swagger-ui .btn.cancel:hover {
        background: #374151 !important;
        color: #e5e7eb !important;
      }
      
      /* Try it out button */
      .swagger-ui .btn.try-out__btn {
        background: transparent !important;
        color: #3b82f6 !important;
        border-color: #3b82f6 !important;
      }
      
      .swagger-ui .btn.try-out__btn:hover {
        background: #3b82f6 !important;
        color: white !important;
      }
      
      /* Clear button */
      .swagger-ui button.btn.clear {
        background: transparent !important;
        color: #94a3b8 !important;
        border-color: #4b5563 !important;
      }
      
      .swagger-ui button.btn.clear:hover {
        background: #374151 !important;
        color: #e5e7eb !important;
      }
      
      /* Download and Copy buttons */
      .swagger-ui .download-contents {
        background: #3b82f6 !important;
        color: white !important;
      }
      
      .swagger-ui .download-contents:hover {
        background: #2563eb !important;
      }
      
      .swagger-ui .copy-to-clipboard {
        background: transparent !important;
        color: #94a3b8 !important;
        border: 1px solid #4b5563 !important;
      }
      
      .swagger-ui .copy-to-clipboard:hover {
        background: #374151 !important;
        color: #e5e7eb !important;
      }
      
      /* ===== INPUT FIELDS ===== */
      .swagger-ui input[type=text],
      .swagger-ui input[type=password],
      .swagger-ui input[type=email],
      .swagger-ui textarea,
      .swagger-ui select {
        background: #1f2937 !important;
        color: #e5e7eb !important;
        border: 1px solid #4b5563 !important;
        border-radius: 6px !important;
        padding: 8px 12px !important;
        font-size: 14px !important;
      }
      
      .swagger-ui input[type=text]:focus,
      .swagger-ui input[type=password]:focus,
      .swagger-ui input[type=email]:focus,
      .swagger-ui textarea:focus,
      .swagger-ui select:focus {
        border-color: #3b82f6 !important;
        outline: none !important;
        box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1) !important;
      }
      
      /* Media type selector */
      .swagger-ui .opblock-body select {
        background: #1f2937 !important;
        color: #e5e7eb !important;
        border: 1px solid #4b5563 !important;
      }
      
      /* ===== CODE BLOCKS ===== */
      .swagger-ui .highlight-code {
        background: #111827 !important;
        border: 1px solid #374151 !important;
        border-radius: 6px !important;
        padding: 16px !important;
      }
      
      .swagger-ui .highlight-code pre {
        background: transparent !important;
        color: #e5e7eb !important;
        margin: 0 !important;
        font-family: 'JetBrains Mono', 'Fira Code', Consolas, monospace !important;
        font-size: 13px !important;
        line-height: 1.5 !important;
      }
      
      /* ===== MODELS AND SCHEMAS ===== */
      .swagger-ui .model-box {
        background: #111827 !important;
        border: 1px solid #374151 !important;
        border-radius: 6px !important;
        padding: 16px !important;
      }
      
      .swagger-ui .model-container > .model-box {
        background: #111827 !important;
        border: 1px solid #374151 !important;
      }
      
      .swagger-ui .model {
        color: #e5e7eb !important;
        font-family: 'JetBrains Mono', 'Fira Code', Consolas, monospace !important;
      }
      
      .swagger-ui .model .property {
        color: #f3f4f6 !important;
      }
      
      .swagger-ui .model .property-name {
        color: #3ecf8e !important;
        font-weight: 600 !important;
      }
      
      .swagger-ui .model .property-type {
        color: #60a5fa !important;
        font-weight: 500 !important;
      }
      
      /* Model toggles - WHITE text for collapsed models */
      .swagger-ui .model-toggle,
      .swagger-ui .model .model-toggle,
      .swagger-ui .model-container .model .model-toggle,
      .swagger-ui span.model-toggle,
      .swagger-ui .models .model .model-toggle,
      .swagger-ui .models-control .model-toggle {
        color: #ffffff !important;
        font-weight: 500 !important;
        cursor: pointer !important;
        transition: color 0.2s ease !important;
      }
      
      .swagger-ui .model-toggle:hover,
      .swagger-ui .model .model-toggle:hover,
      .swagger-ui span.model-toggle:hover {
        color: #3ecf8e !important;
      }
      
      .swagger-ui .model .model-title {
        color: #ffffff !important;
      }
      
      /* Model toggle arrows */
      .swagger-ui .model-toggle:before,
      .swagger-ui .model-toggle:after {
        color: #ffffff !important;
      }
      
      /* ===== PARAMETERS ===== */
      .swagger-ui .parameter__name {
        color: #3ecf8e !important;
        font-weight: 600 !important;
      }
      
      .swagger-ui .parameter__type {
        color: #60a5fa !important;
        font-weight: 500 !important;
      }
      
      .swagger-ui .parameter__deprecated {
        color: #f87171 !important;
      }
      
      /* Required asterisk */
      .swagger-ui .parameter__name.required:after {
        color: #f87171 !important;
      }
      
      /* ===== RESPONSES ===== */
      /* Response descriptions */
      .swagger-ui .response-col_description {
        color: #e5e7eb !important;
        font-weight: 500 !important;
      }
      
      .swagger-ui .response-col_links {
        color: #e5e7eb !important;
      }
      
      /* Response tables */
      .swagger-ui .responses-table .response-col_status {
        color: #f3f4f6 !important;
      }
      
      .swagger-ui .responses-table th {
        color: #f3f4f6 !important;
        background: #111827 !important;
      }
      
      /* Response content type */
      .swagger-ui .response-content-type {
        color: #94a3b8 !important;
      }
      
      .swagger-ui .response-content-type .content-type {
        color: #60a5fa !important;
      }
      
      /* ===== ICONS AND SVG ===== */
      .swagger-ui svg {
        fill: #e5e7eb !important;
      }
      
      /* Expand/collapse arrows */
      .swagger-ui .opblock .opblock-summary-control {
        color: #e5e7eb !important;
      }
      
      .swagger-ui .expand-operation svg,
      .swagger-ui .expand-methods svg {
        fill: #e5e7eb !important;
      }
      
      /* ===== AUTHORIZATION MODAL ===== */
      .swagger-ui .auth,
      .swagger-ui .auth-container {
        background: #1f2937 !important;
        border: 1px solid #374151 !important;
        border-radius: 8px !important;
        color: #e5e7eb !important;
        margin: 0px !important;
      }
      
      .swagger-ui .auth .auth-wrapper {
        background: #1f2937 !important;
        color: #e5e7eb !important;
        padding: 24px !important;
        border-radius: 8px !important;
      }
      
      .swagger-ui .auth .auth-wrapper .scopes h2,
      .swagger-ui .auth .auth-wrapper h4 {
        color: #3ecf8e !important;
        margin-bottom: 16px !important;
      }
      
      .swagger-ui .auth .auth-wrapper p {
        color: #d1d5db !important;
      }
      
      /* Auth input fields */
      .swagger-ui .auth .auth-wrapper input[type="text"],
      .swagger-ui .auth .auth-wrapper input[type="password"] {
        background: #111827 !important;
        border: 1px solid #4b5563 !important;
        color: #e5e7eb !important;
        border-radius: 6px !important;
        padding: 8px 12px !important;
      }
      
      .swagger-ui .auth .auth-wrapper input[type="text"]:focus,
      .swagger-ui .auth .auth-wrapper input[type="password"]:focus {
        border-color: #3ecf8e !important;
        outline: none !important;
        box-shadow: 0 0 0 3px rgba(62, 207, 142, 0.1) !important;
      }
      
      /* Auth buttons container - improved spacing */
      .swagger-ui .auth .auth-wrapper .auth-btn-wrapper,
      .swagger-ui .auth .auth-wrapper .btn-wrapper,
      .swagger-ui .modal-ux .auth-btn-wrapper {
        display: flex !important;
        gap: 12px !important;
        justify-content: flex-end !important;
        margin-top: 24px !important;
        padding-top: 20px !important;
        border-top: 1px solid #374151 !important;
      }
      
      /* Auth buttons - enhanced styling */
      .swagger-ui .auth .auth-wrapper .btn,
      .swagger-ui .modal-ux .auth .btn {
        background: #3ecf8e !important;
        color: #0f1419 !important;
        border: none !important;
        border-radius: 8px !important;
        padding: 12px 24px !important;
        font-weight: 600 !important;
        font-size: 14px !important;
        min-width: 90px !important;
        transition: all 0.2s ease !important;
        cursor: pointer !important;
        text-align: center !important;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1) !important;
      }
      
      .swagger-ui .auth .auth-wrapper .btn:hover,
      .swagger-ui .modal-ux .auth .btn:hover {
        background: #2dd4bf !important;
        transform: translateY(-1px) !important;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15) !important;
      }
      
      /* Cancel/Close button styling */
      .swagger-ui .auth .auth-wrapper .btn.cancel,
      .swagger-ui .modal-ux .auth .btn.cancel,
      .swagger-ui .auth .auth-wrapper .btn-secondary,
      .swagger-ui .modal-ux .auth .btn-secondary {
        background: transparent !important;
        color: #94a3b8 !important;
        border: 2px solid #4b5563 !important;
        box-shadow: none !important;
      }
      
      .swagger-ui .auth .auth-wrapper .btn.cancel:hover,
      .swagger-ui .modal-ux .auth .btn.cancel:hover,
      .swagger-ui .auth .auth-wrapper .btn-secondary:hover,
      .swagger-ui .modal-ux .auth .btn-secondary:hover {
        background: #374151 !important;
        color: #e5e7eb !important;
        border-color: #6b7280 !important;
        transform: translateY(-1px) !important;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1) !important;
      }
      
      /* Login/Authorize button specific styling */
      .swagger-ui .auth .auth-wrapper .btn.authorize,
      .swagger-ui .modal-ux .auth .btn.authorize,
      .swagger-ui .auth .auth-wrapper .btn-primary,
      .swagger-ui .modal-ux .auth .btn-primary {
        background: linear-gradient(135deg, #3ecf8e 0%, #2dd4bf 100%) !important;
        color: #0f1419 !important;
        font-weight: 700 !important;
        position: relative !important;
        overflow: hidden !important;
      }
      
      .swagger-ui .auth .auth-wrapper .btn.authorize:hover,
      .swagger-ui .modal-ux .auth .btn.authorize:hover,
      .swagger-ui .auth .auth-wrapper .btn-primary:hover,
      .swagger-ui .modal-ux .auth .btn-primary:hover {
        background: linear-gradient(135deg, #2dd4bf 0%, #14b8a6 100%) !important;
      }
      
      /* Button text styling */
      .swagger-ui .auth .auth-wrapper .btn span,
      .swagger-ui .modal-ux .auth .btn span {
        position: relative !important;
        z-index: 1 !important;
      }
      
      /* Auth button wrapper */
      .swagger-ui .auth-btn-wrapper .btn-sm {
        background: transparent !important;
        color: #3ecf8e !important;
        border: 1px solid #3ecf8e !important;
      }
      
      .swagger-ui .auth-btn-wrapper .btn-sm:hover {
        background: #3ecf8e !important;
        color: #0f1419 !important;
      }
      
      .swagger-ui .authorization .authorization__button {
        color: #e5e7eb !important;
        border-color: #374151 !important;
      }
      
      .swagger-ui .authorization .authorization__button:hover {
        background: #374151 !important;
        color: #ffffff !important;
      }
      
      /* ===== MODAL ===== */
      .swagger-ui .modal-ux {
        background: rgba(15, 20, 25, 0.8) !important;
        backdrop-filter: blur(4px) !important;
      }
      
      .swagger-ui .modal-ux-content {
        background: #1f2937 !important;
        border: 1px solid #374151 !important;
        border-radius: 12px !important;
        color: #e5e7eb !important;
      }
      
      .swagger-ui .modal-ux-header {
        background: #111827 !important;
        border-bottom: 1px solid #374151 !important;
        color: #f3f4f6 !important;
        padding: 16px 24px !important;
      }
      
      .swagger-ui .modal-ux-header h3 {
        color: #3ecf8e !important;
        margin: 0 !important;
      }
      
      .swagger-ui .modal-ux-content .close-modal {
        color: #94a3b8 !important;
        background: transparent !important;
        border: none !important;
        font-size: 20px !important;
      }
      
      .swagger-ui .modal-ux-content .close-modal:hover {
        color: #e5e7eb !important;
        background: #374151 !important;
        border-radius: 4px !important;
      }
      
      /* ===== SCHEME CONTAINER ===== */
      .swagger-ui .scheme-container {
        background: #1f2937 !important;
        border: 1px solid #374151 !important;
        border-radius: 8px !important;
        padding: 16px !important;
        margin: 20px 0 !important;
      }
      
      .swagger-ui .scheme-container .schemes-title {
        color: #ffffff !important;
        margin-bottom: 12px !important;
      }
      
      /* ===== TABS ===== */
      .swagger-ui .tab-content {
        background: transparent !important;
      }
      
      .swagger-ui .tab li {
        color: #94a3b8 !important;
      }
      
      .swagger-ui .tab li.active {
        color: #3ecf8e !important;
      }
      
      /* ===== EXAMPLE VALUES ===== */
      .swagger-ui .model-example {
        background: #111827 !important;
        border: 1px solid #374151 !important;
      }
      
      .swagger-ui .example__value {
        color: #e5e7eb !important;
      }
      
      /* ===== LINKS ===== */
      .swagger-ui a {
        color: #3ecf8e !important;
      }
      
      .swagger-ui a:hover {
        color: #2dd4bf !important;
      }
      
      /* ===== SCROLLBAR ===== */
      .swagger-ui ::-webkit-scrollbar {
        width: 6px;
        height: 6px;
      }
      
      .swagger-ui ::-webkit-scrollbar-track {
        background: #1f2937;
      }
      
      .swagger-ui ::-webkit-scrollbar-thumb {
        background: #4b5563;
        border-radius: 3px;
      }
      
      .swagger-ui ::-webkit-scrollbar-thumb:hover {
        background: #6b7280;
      }
      
      /* ===== LOADING SPINNER ===== */
      .swagger-ui .loading-container .loading:after {
        border-color: #3ecf8e transparent #3ecf8e transparent !important;
      }
      
      /* ===== MISCELLANEOUS TEXT FIXES ===== */
      /* Section headers */
      .swagger-ui h4, .swagger-ui h3, .swagger-ui h2 {
        color: #3ecf8e !important;
      }
      
      /* Fix dark text colors */
      .swagger-ui .renderedMarkdown p,
      .swagger-ui .opblock-description p,
      .swagger-ui .opblock-summary-description {
        color: #d1d5db !important;
      }
      
      .swagger-ui .opblock-body .opblock-description,
      .swagger-ui .opblock-external-docs,
      .swagger-ui .opblock-external-docs-description {
        color: #d1d5db !important;
      }
      
      .swagger-ui .opblock-external-docs-wrapper h4 {
        color: #3ecf8e !important;
      }
      
      .swagger-ui .markdown,
      .swagger-ui .renderedMarkdown,
      .swagger-ui .markdown p {
        color: #d1d5db !important;
      }
      
      .swagger-ui .property-row .property-description {
        color: #d1d5db !important;
      }
      
      .swagger-ui .model .renderedMarkdown p {
        color: #d1d5db !important;
      }
      
      .swagger-ui .opblock-summary-description,
      .swagger-ui .parameter__extension,
      .swagger-ui .parameter__in,
      .swagger-ui .col_header {
        color: #94a3b8 !important;
      }
      
      /* Fix any remaining white backgrounds */
      .swagger-ui .wrapper,
      .swagger-ui .opblock-body pre,
      .swagger-ui .opblock-description-wrapper,
      .swagger-ui .opblock-external-docs-wrapper {
        background: transparent !important;
      }
      
      /* Force override dark inline styles */
      .swagger-ui [style*="color:#3b4151"],
      .swagger-ui [style*="color: #3b4151"],
      .swagger-ui [style*="color:rgb(59,65,81)"],
      .swagger-ui [style*="color: rgb(59, 65, 81)"] {
        color: #d1d5db !important;
      }
      
      /* ===== COPYABLE TEXT ELEMENTS ===== */
      /* Make API paths, URLs, and code snippets easily copyable */
      .swagger-ui .renderedMarkdown code,
      .swagger-ui .highlight-code pre,
      .swagger-ui .model-example,
      .swagger-ui .example__value,
      .swagger-ui .parameter__name,
      .swagger-ui .response-col_description code,
      .swagger-ui .opblock-summary-path,
      .swagger-ui .servers select option,
      .swagger-ui .servers .url,
      .swagger-ui .scheme-container .schemes > label > select option {
        user-select: text !important;
        cursor: text !important;
      }
      
      /* Ensure base URL and server URLs are copyable */
      .swagger-ui .servers .url,
      .swagger-ui .servers select,
      .swagger-ui .servers option {
        user-select: text !important;
        cursor: pointer !important;
      }
      
      /* Make sure the text inside server dropdown is selectable */
      .swagger-ui .servers select:focus,
      .swagger-ui .servers select:active {
        user-select: text !important;
      }
      
      /* Override any user-select: none that might be applied globally */
      .swagger-ui .opblock-summary,
      .swagger-ui .opblock-summary * {
        user-select: text !important;
      }
      
      /* But keep buttons non-selectable for better UX */
      .swagger-ui .btn,
      .swagger-ui button,
      .swagger-ui .opblock-summary-control,
      .swagger-ui .authorization__btn {
        user-select: none !important;
        cursor: pointer !important;
      }
    `,
  });

  // =========================================================================
  // SERVER STARTUP
  // =========================================================================
  const port = configService.get<number>('port', 3000);
  const nodeEnv = configService.get<string>('env', 'development');

  await app.listen(port);
  const appUrl = await app.getUrl();

  // Log startup information
  logger.log({
    message: 'Application started',
    port,
    environment: nodeEnv,
    url: appUrl,
  });

  logger.log({
    message: 'Swagger documentation available',
    url: `${appUrl}/docs`,
  });
}

// =========================================================================
// GRACEFUL SHUTDOWN HANDLERS
// =========================================================================
let app: any = null;

// Handle graceful shutdown on SIGTERM (Kubernetes, Docker, PM2)
process.on('SIGTERM', async () => {
  console.warn('SIGTERM signal received: closing HTTP server gracefully');

  if (app) {
    try {
      // Give ongoing requests 10 seconds to complete
      const shutdownTimeout = setTimeout(() => {
        console.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);

      // Close NestJS application
      await app.close();
      clearTimeout(shutdownTimeout);

      console.warn('HTTP server closed successfully');
      process.exit(0);
    } catch (error) {
      console.error('Error during graceful shutdown:', error);
      process.exit(1);
    }
  } else {
    process.exit(0);
  }
});

// Handle graceful shutdown on SIGINT (Ctrl+C)
process.on('SIGINT', async () => {
  console.warn('\nSIGINT signal received: closing HTTP server gracefully');

  if (app) {
    try {
      await app.close();
      console.warn('HTTP server closed successfully');
      process.exit(0);
    } catch (error) {
      console.error('Error during graceful shutdown:', error);
      process.exit(1);
    }
  } else {
    process.exit(0);
  }
});

// Handle uncaught exceptions
process.on('uncaughtException', error => {
  console.error('Uncaught Exception:', error);
  // Log the error but keep the process running
  // In production, you might want to restart the process
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Log the error but keep the process running
});

// =========================================================================
// APPLICATION BOOTSTRAP
// =========================================================================
bootstrap()
  .then(nestApp => {
    app = nestApp; // Store app reference for graceful shutdown
  })
  .catch(err => {
    console.error('Error starting application:', err);
    process.exit(1);
  });
