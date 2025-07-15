// Repository injection tokens
export const USER_REPOSITORY = Symbol('UserRepository');
export const ROLE_REPOSITORY = Symbol('RoleRepository');
export const PERMISSION_REPOSITORY = Symbol('PermissionRepository');
export const REFRESH_TOKEN_REPOSITORY = Symbol('RefreshTokenRepository');
export const OTP_REPOSITORY = Symbol('OtpRepository');
export const EMAIL_VERIFICATION_REPOSITORY = Symbol('EmailVerificationRepository');
export const PASSWORD_RESET_REPOSITORY = Symbol('PasswordResetRepository');
export const FILE_REPOSITORY = Symbol('FileRepository');
export const COMPANY_REPOSITORY = Symbol('CompanyRepository');

// Repository tokens object
export const REPOSITORY_TOKENS = {
  USER_REPOSITORY,
  ROLE_REPOSITORY,
  PERMISSION_REPOSITORY,
  REFRESH_TOKEN_REPOSITORY,
  OTP_REPOSITORY,
  EMAIL_VERIFICATION_REPOSITORY,
  PASSWORD_RESET_REPOSITORY,
  FILE_REPOSITORY,
  COMPANY_REPOSITORY,
} as const;

// Service injection tokens
export const THROTTLER_SERVICE = Symbol('ThrottlerService');
