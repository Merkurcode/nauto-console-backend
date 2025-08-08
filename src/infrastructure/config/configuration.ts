export default () => ({
  // Application
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  appName: process.env.APP_NAME || 'NestJS Template',
  apiUrl: process.env.API_URL || 'http://localhost:3001',
  apiVersion: process.env.API_VERSION || 'v1',

  // Database
  database: {
    url: process.env.DATABASE_URL,
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET,
    accessExpiration: process.env.JWT_ACCESS_EXPIRATION || '15m',
    refreshExpiration: process.env.JWT_REFRESH_EXPIRATION || '7d',
  },

  // OTP
  otp: {
    secret: process.env.OTP_SECRET,
    expiration: parseInt(process.env.OTP_EXPIRATION || '5', 10),
    step: parseInt(process.env.OTP_STEP || '30', 10),
    digits: parseInt(process.env.OTP_DIGITS || '6', 10),
  },

  // SMTP/Email
  smtp: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER,
    password: process.env.SMTP_PASSWORD,
    from: process.env.SMTP_FROM,
    secure: process.env.SMTP_SECURE === 'true',
  },

  // Email providers
  email: {
    provider: process.env.EMAIL_PROVIDER || 'mailhog',
    supportEmail: process.env.SUPPORT_EMAIL || 'support@nauotoconsole.com',
    noReplyEmail: process.env.NO_REPLY_EMAIL || 'noreply@nautoconsole.com',
    templates: {
      companyLogo: process.env.EMAIL_COMPANY_LOGO_URL || '',
      primaryColor: process.env.EMAIL_PRIMARY_COLOR || '#007bff',
      secondaryColor: process.env.EMAIL_SECONDARY_COLOR || '#6c757d',
    },
  },

  // Resend
  resend: {
    apiKey: process.env.RESEND_API_KEY,
    fromEmail: process.env.RESEND_FROM_EMAIL,
    apiUrl: process.env.RESEND_API_URL || 'https://api.resend.com/emails',
  },

  // SMS
  sms: {
    masivos: {
      apiUrl: process.env.SMS_MASIVOS_API_URL,
      apiKey: process.env.SMS_MASIVOS_API_KEY,
    },
  },

  // Frontend
  frontend: {
    url: process.env.FRONTEND_URL || 'http://localhost:3000',
    loginPath: process.env.FRONTEND_LOGIN_PATH || '/login',
    passwordResetPath: process.env.FRONTEND_PASSWORD_RESET_PATH || '/reset-password',
    emailVerificationPath: process.env.FRONTEND_EMAIL_VERIFICATION_PATH || '/verify-email',
    dashboardPath: process.env.FRONTEND_DASHBOARD_PATH || '/dashboard',
  },

  // CORS
  cors: {
    allowedOrigins: process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',')
      : ['http://localhost:3000'],
  },

  // Security
  security: {
    sessionSecret: process.env.SESSION_SECRET,
    requestIntegrityEnabled: process.env.REQUEST_INTEGRITY_ENABLED === 'true',
  },

  // Storage
  storage: {
    provider: process.env.STORAGE_PROVIDER || 'local',
    minio: {
      endPoint: process.env.MINIO_ENDPOINT,
      port: parseInt(process.env.MINIO_PORT || '9000', 10),
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY,
      secretKey: process.env.MINIO_SECRET_KEY,
      region: process.env.MINIO_REGION || 'us-east-1',
      publicBucket: process.env.MINIO_PUBLIC_BUCKET || 'public',
      privateBucket: process.env.MINIO_PRIVATE_BUCKET || 'private',
    },
    aws: {
      region: process.env.AWS_REGION,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      bucketName: process.env.AWS_S3_BUCKET_NAME,
    },
  },

  // Swagger
  swagger: {
    user: process.env.SWAGGER_USER,
    password: process.env.SWAGGER_PASSWORD,
  },

  // Throttler
  throttler: {
    ttl: parseInt(process.env.THROTTLER_TTL || '60', 10),
    limit: parseInt(process.env.THROTTLER_LIMIT || '10', 10),
    ignoreUserAgents: process.env.THROTTLER_IGNORE_USER_AGENTS
      ? process.env.THROTTLER_IGNORE_USER_AGENTS.split(',')
      : [],
  },

  // Monitoring and system services
  monitoring: {
    memoryMonitoringEnabled: process.env.MEMORY_MONITORING_ENABLED === 'true',
    healthMonitoringEnabled: process.env.MONITORING_HEALTH_ENABLED === 'true', 
    circuitBreakerMonitoringEnabled: process.env.CIRCUIT_BREAKER_MONITORING === 'true',
  },


  // i18n
  i18n: {
    defaultLocale: process.env.DEFAULT_LOCALE || 'en',
    fallbackLocale: process.env.FALLBACK_LOCALE || 'en',
    supportedLocales: process.env.SUPPORTED_LOCALES
      ? process.env.SUPPORTED_LOCALES.split(',')
      : ['en', 'ar'],
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
});
