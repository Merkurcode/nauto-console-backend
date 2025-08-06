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
export const COMPANY_EVENTS_CATALOG_REPOSITORY = Symbol('CompanyEventsCatalogRepository');
export const COMPANY_SCHEDULES_REPOSITORY = Symbol('CompanySchedulesRepository');

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
  COMPANY_EVENTS_CATALOG_REPOSITORY,
  COMPANY_SCHEDULES_REPOSITORY,
} as const;

// Service injection tokens
export const THROTTLER_SERVICE = Symbol('ThrottlerService');
export const LOGGER_SERVICE = Symbol('ILogger');
export const TOKEN_PROVIDER = Symbol('ITokenProvider');
export const DATABASE_HEALTH = Symbol('IDatabaseHealth');
