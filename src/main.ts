import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AllExceptionsFilter } from '@presentation/filters/all-exceptions.filter';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as basicAuth from 'express-basic-auth';
import helmet from 'helmet';
import { LoggerService } from '@infrastructure/logger/logger.service';

async function bootstrap() {
  // =========================================================================
  // APPLICATION SETUP
  // =========================================================================
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const logger = await app.resolve(LoggerService);

  logger.setContext('Application');

  // =========================================================================
  // SECURITY MIDDLEWARE
  // =========================================================================
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'", "'unsafe-inline'"], // Added unsafe-inline for custom JS
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
    }),
  );

  // =========================================================================
  // CUSTOM MIDDLEWARE
  // =========================================================================
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
        'Content-Type, Authorization, Accept-Language, X-Tenant-ID, ngrok-skip-browser-warning',
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
  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
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

  // In development, allow all origins for easier testing with ngrok
  const corsOptions = {
    origin:
      configService.get<string>('env') === 'development'
        ? true // Allow all origins in development
        : allowedOrigins,
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
    .setTitle('Nauto Console API')
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
    },
    customSiteTitle: 'NestJS Clean Architecture API',

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
        padding: 16px 20px !important;
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

    // =========================================================================
    // CUSTOM JAVASCRIPT FOR STATUS CODE COLORS
    // =========================================================================
    customJs: `
      // Enhanced status code color application
      function applyStatusCodeColors() {
        try {
          // Find all status code elements with multiple selectors
          const statusElements = document.querySelectorAll(
            '.swagger-ui .response-col_status, ' +
            '.swagger-ui td.response-col_status, ' +
            '.swagger-ui .live-responses-table .response-col_status, ' +
            '.swagger-ui .responses-table .response-col_status'
          );
          
          statusElements.forEach(element => {
            const text = (element.textContent || element.innerText || '').trim();
            
            // Remove any existing status code classes
            element.classList.remove('status-200', 'status-error');
            
            // Apply base styling
            element.style.setProperty('font-weight', '700', 'important');
            element.style.setProperty('border-radius', '4px', 'important');
            element.style.setProperty('padding', '4px 8px', 'important');
            element.style.setProperty('font-size', '12px', 'important');
            element.style.setProperty('display', 'inline-block', 'important');
            element.style.setProperty('min-width', '50px', 'important');
            element.style.setProperty('text-align', 'center', 'important');
            
            // Default: RED background for all status codes
            element.style.setProperty('background-color', '#ef4444', 'important');
            element.style.setProperty('color', '#ffffff', 'important');
            
            // Special case: GREEN only for 200 status codes
            if (text === '200' || text === '200 OK' || text.match(/^200\\s/)) {
              element.style.setProperty('background-color', '#10b981', 'important');
              element.style.setProperty('color', '#ffffff', 'important');
              element.classList.add('status-200');
            } else {
              element.classList.add('status-error');
            }
          });
        } catch (error) {
          console.warn('Status code color application failed:', error);
        }
      }
      
      // Apply colors immediately
      applyStatusCodeColors();
      
      // Apply when DOM is ready
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applyStatusCodeColors);
      } else {
        // DOM is already ready, apply immediately
        setTimeout(applyStatusCodeColors, 100);
      }
      
      // Create a more aggressive observer for dynamic content
      const observer = new MutationObserver(function(mutations) {
        let shouldApply = false;
        
        mutations.forEach(function(mutation) {
          // Check for added nodes
          if (mutation.addedNodes.length > 0) {
            shouldApply = true;
          }
          
          // Check for text changes
          if (mutation.type === 'characterData') {
            shouldApply = true;
          }
          
          // Check for attribute changes on response elements
          if (mutation.type === 'attributes' && 
              mutation.target.classList && 
              mutation.target.classList.contains('response-col_status')) {
            shouldApply = true;
          }
        });
        
        if (shouldApply) {
          setTimeout(applyStatusCodeColors, 10);
        }
      });
      
      // Start observing with comprehensive options
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['class', 'style']
      });
      
      // Additional aggressive intervals to catch any missed updates
      setInterval(applyStatusCodeColors, 250);
      
      // Apply on window focus (in case of missed updates)
      window.addEventListener('focus', applyStatusCodeColors);
      
      // Apply on click events (when user interacts with Swagger)
      document.addEventListener('click', function() {
        setTimeout(applyStatusCodeColors, 100);
      });
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
// APPLICATION BOOTSTRAP
// =========================================================================
bootstrap().catch(err => {
  console.error('Error starting application:', err);
  process.exit(1);
});
