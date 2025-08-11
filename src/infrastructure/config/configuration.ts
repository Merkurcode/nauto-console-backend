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
    connectionLimit: parseInt(process.env.DATABASE_CONNECTION_LIMIT || '50', 10),
    poolTimeout: parseInt(process.env.DATABASE_POOL_TIMEOUT || '30', 10),
    queryTimeout: parseInt(process.env.DATABASE_QUERY_TIMEOUT || '10000', 10),
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET,
    algorithm: process.env.JWT_ALGORITHM || 'HS512',
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
    serverIntegritySecret: process.env.SERVER_INTEGRITY_SECRET,
    botIntegritySecret: process.env.BOT_INTEGRITY_SECRET,
    signatureTimestampSkewSeconds: parseInt(
      process.env.SIGNATURE_TIMESTAMP_SKEW_SECONDS || '30',
      10,
    ),
    signatureValidationLogs: process.env.SIGNATURE_VALIDATION_LOGS === 'true',
    requestMaxContentLength: parseInt(process.env.REQUEST_MAX_CONTENT_LENGTH || '10485760', 10),
    sensitiveOperationsEnabled: process.env.SENSITIVE_OPERATIONS_ENABLED !== 'false',
  },

  // Storage
  storage: {
    provider: process.env.STORAGE_DRIVER || 'local',
    minio: {
      endPoint: process.env.MINIO_ENDPOINT,
      port: parseInt(process.env.MINIO_PORT || '9000', 10),
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY,
      secretKey: process.env.MINIO_SECRET_KEY,
      region: process.env.MINIO_REGION || 'us-east-1',
      bucketName: process.env.MINIO_BUCKET_NAME,
      publicFolder: 'public',
      privateFolder: 'private',
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

  // Throttler - Strategic rate limiting configuration
  throttler: {
    ttl: parseInt(process.env.THROTTLER_TTL || '60', 10), // 60 seconds window
    limit: parseInt(process.env.THROTTLER_LIMIT || '100', 10), // 100 requests per minute (reasonable for API)
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

  // Business Logic Configuration
  business: {
    // Email verification
    emailVerification: {
      enabled: process.env.EMAIL_VERIFICATION_ENABLED !== 'false',
      expiryMinutes: parseInt(process.env.EMAIL_VERIFICATION_EXPIRY_MINUTES || '60', 10),
    },
    // Password security policies
    password: {
      saltRounds: parseInt(process.env.PASSWORD_SALT_ROUNDS || '12', 10),
      resetExpiryMinutes: parseInt(process.env.PASSWORD_RESET_EXPIRY_MINUTES || '30', 10),
      minLength: parseInt(process.env.PASSWORD_MIN_LENGTH || '8', 10),
      requireSpecial: process.env.PASSWORD_REQUIRE_SPECIAL !== 'false',
    },
    // Rate limiting
    rateLimit: {
      emailAttempts: parseInt(process.env.RATE_LIMIT_EMAIL_ATTEMPTS || '3', 10),
      ipAttempts: parseInt(process.env.RATE_LIMIT_IP_ATTEMPTS || '10', 10),
      lockoutMinutes: parseInt(process.env.RATE_LIMIT_LOCKOUT_MINUTES || '15', 10),
    },
    // File storage policies
    files: {
      urlExpiryHours: parseInt(process.env.FILE_URL_EXPIRY_HOURS || '24', 10),
    },
    // Session management
    sessions: {
      maxActive: parseInt(process.env.MAX_ACTIVE_SESSIONS || '3', 10),
      inactivityTimeout: parseInt(process.env.SESSION_INACTIVITY_TIMEOUT || '120', 10),
      extendOnActivity: process.env.SESSION_EXTEND_ON_ACTIVITY !== 'false',
    },
    // Address defaults
    address: {
      defaultCountry: process.env.DEFAULT_COUNTRY || null,
      defaultState: process.env.DEFAULT_STATE || null,
      requireFullAddress: process.env.REQUIRE_FULL_ADDRESS === 'true',
    },
    // OTP/2FA business configuration
    otpBusiness: {
      enabled: process.env.OTP_ENABLED !== 'false',
      maxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS || '3', 10),
      secretLength: parseInt(process.env.OTP_SECRET_LENGTH || '32', 10),
    },
    // Storage tiers
    storageTiers: {
      defaultTierLevel: parseInt(process.env.DEFAULT_STORAGE_TIER_LEVEL || '1', 10),
      defaultAllowedFileConfig: process.env.DEFAULT_ALLOWED_FILE_CONFIG,
    },
  },
});
