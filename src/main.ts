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
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const logger = await app.resolve(LoggerService);

  logger.setContext('Application');

  // Security middleware
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
        },
      },
    }),
  );

  // Add middleware to handle ngrok and preflight requests
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

  // Enable CORS with security settings
  const allowedOrigins = configService.get<string>('ALLOWED_ORIGINS')?.split(',') || [
    'http://localhost:3000',
  ];

  // In development, allow all origins for easier testing with ngrok
  const corsOptions = {
    origin:
      configService.get<string>('NODE_ENV') === 'development'
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
      'ngrok-skip-browser-warning', // Allow ngrok header
    ],
    optionsSuccessStatus: 200,
  };

  app.enableCors(corsOptions);

  // API prefix
  app.setGlobalPrefix('api');

  // Get i18n service to use in Swagger
  const i18nService = app.get(ConfigService).get('i18n');
  const supportedLanguages = i18nService?.supportedLocales || ['en', 'ar'];

  // Swagger setup
  const config = new DocumentBuilder()
    .setTitle('NestJS Clean Architecture API')
    .setDescription(
      'The API documentation for the NestJS Clean Architecture template with Multi-Tenant support',
    )
    .setVersion('1.0')
    .addTag('auth', 'Authentication endpoints')
    .addTag('users', 'User management endpoints')
    .addTag('roles', 'Role management endpoints')
    .addTag('companies', 'Company management endpoints (Multi-Tenant)')
    .addTag('admin', 'Admin endpoints')
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
      'JWT-auth', // This is a key to be used in @ApiBearerAuth() decorator
    )
    .build();

  // Basic Auth for Swagger (only in production)
  if (configService.get<string>('NODE_ENV') === 'production') {
    app.use(
      '/docs',
      basicAuth({
        challenge: true,
        users: {
          [configService.get<string>('SWAGGER_USER', 'admin')]: configService.get<string>(
            'SWAGGER_PASSWORD',
            'admin',
          ),
        },
      }),
    );
  }

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
  });

  // Start server
  const port = configService.get<number>('PORT', 3000);
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');

  await app.listen(port);
  const appUrl = await app.getUrl();

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

bootstrap().catch(err => {
  console.error('Error starting application:', err);
  process.exit(1);
});
