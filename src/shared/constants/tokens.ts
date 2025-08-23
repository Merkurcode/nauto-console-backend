// Repository injection tokens
export const USER_REPOSITORY = Symbol('UserRepository');
export const ROLE_REPOSITORY = Symbol('RoleRepository');
export const PERMISSION_REPOSITORY = Symbol('PermissionRepository');
export const REFRESH_TOKEN_REPOSITORY = Symbol('RefreshTokenRepository');
export const OTP_REPOSITORY = Symbol('OtpRepository');
export const EMAIL_VERIFICATION_REPOSITORY = Symbol('EmailVerificationRepository');
export const PASSWORD_RESET_REPOSITORY = Symbol('PasswordResetRepository');
export const PASSWORD_RESET_ATTEMPT_REPOSITORY = Symbol('PasswordResetAttemptRepository');
export const FILE_REPOSITORY = Symbol('FileRepository');
export const COMPANY_REPOSITORY = Symbol('CompanyRepository');
export const SESSION_REPOSITORY = Symbol('SessionRepository');
export const COUNTRY_REPOSITORY = Symbol('CountryRepository');
export const STATE_REPOSITORY = Symbol('StateRepository');
export const AI_ASSISTANT_REPOSITORY = Symbol('AIAssistantRepository');
export const COMPANY_AI_ASSISTANT_REPOSITORY = Symbol('CompanyAIAssistantRepository');
export const COMPANY_SCHEDULES_REPOSITORY = Symbol('CompanySchedulesRepository');
export const AUDIT_LOG_REPOSITORY = Symbol('AuditLogRepository');
export const BOT_TOKEN_REPOSITORY = Symbol('BotTokenRepository');
export const USER_PROFILE_REPOSITORY = Symbol('UserProfileRepository');
export const USER_ADDRESS_REPOSITORY = Symbol('UserAddressRepository');
export const USER_STORAGE_CONFIG_REPOSITORY = Symbol('UserStorageConfigRepository');
export const STORAGE_TIERS_REPOSITORY = Symbol('StorageTiersRepository');
export const USER_ACTIVITY_LOG_REPOSITORY = Symbol('UserActivityLogRepository');
export const PERSONA_REPOSITORY = Symbol('PersonaRepository');
export const COMPANY_PERSONA_REPOSITORY = Symbol('CompanyPersonaRepository');
export const AI_PERSONA_REPOSITORY = Symbol('AIPersonaRepository');
export const COMPANY_AI_PERSONA_REPOSITORY = Symbol('CompanyAIPersonaRepository');

// Repository tokens object
export const REPOSITORY_TOKENS = {
  USER_REPOSITORY,
  ROLE_REPOSITORY,
  PERMISSION_REPOSITORY,
  REFRESH_TOKEN_REPOSITORY,
  OTP_REPOSITORY,
  EMAIL_VERIFICATION_REPOSITORY,
  PASSWORD_RESET_REPOSITORY,
  PASSWORD_RESET_ATTEMPT_REPOSITORY,
  FILE_REPOSITORY,
  COMPANY_REPOSITORY,
  SESSION_REPOSITORY,
  COUNTRY_REPOSITORY,
  STATE_REPOSITORY,
  AI_ASSISTANT_REPOSITORY,
  COMPANY_AI_ASSISTANT_REPOSITORY,
  COMPANY_SCHEDULES_REPOSITORY,
  AUDIT_LOG_REPOSITORY,
  BOT_TOKEN_REPOSITORY,
  USER_PROFILE_REPOSITORY,
  USER_ADDRESS_REPOSITORY,
  USER_STORAGE_CONFIG_REPOSITORY,
  STORAGE_TIERS_REPOSITORY,
  USER_ACTIVITY_LOG_REPOSITORY,
  PERSONA_REPOSITORY,
  COMPANY_PERSONA_REPOSITORY,
  AI_PERSONA_REPOSITORY,
  COMPANY_AI_PERSONA_REPOSITORY,
} as const;

// Service injection tokens
export const THROTTLER_SERVICE = Symbol('ThrottlerService');
export const LOGGER_SERVICE = Symbol('ILogger');
export const TOKEN_PROVIDER = Symbol('ITokenProvider');
export const BOT_TOKEN_PROVIDER = Symbol('IBotTokenProvider');
export const DATABASE_HEALTH = Symbol('IDatabaseHealth');
export const AUDIT_LOG_SERVICE = Symbol('AuditLogService');
export const TRANSACTION_MANAGER = Symbol('TransactionManager');

// Storage service tokens
export const STORAGE_SERVICE = Symbol('StorageService');
export const CONCURRENCY_SERVICE = Symbol('ConcurrencyService');
export const FILE_NAMING_SERVICE = Symbol('FileNamingService');
