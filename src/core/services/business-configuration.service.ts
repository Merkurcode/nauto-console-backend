import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Domain service responsible for business configuration values
 * Centralizes all business rules and configurable values
 */
@Injectable()
export class BusinessConfigurationService {
  constructor(private readonly configService: ConfigService) {}

  /**
   * Email verification business configuration
   * Business Rule: Email verification requirement can be enabled/disabled per environment
   */
  getEmailVerificationConfig(): {
    enabled: boolean;
    expirationMinutes: number;
  } {
    const enabledValue = this.configService.get<string>('EMAIL_VERIFICATION_ENABLED', 'false');
    const enabled = enabledValue === 'true';

    return {
      enabled,
      expirationMinutes: this.configService.get<number>('EMAIL_VERIFICATION_EXPIRY_MINUTES', 60),
    };
  }

  /**
   * Password security configuration
   * Business Rule: Password security requirements vary by security level
   */
  getPasswordSecurityConfig(): {
    saltRounds: number;
    resetExpirationMinutes: number;
    minLength: number;
    requireSpecialCharacters: boolean;
  } {
    return {
      saltRounds: this.configService.get<number>('PASSWORD_SALT_ROUNDS', 12),
      resetExpirationMinutes: this.configService.get<number>('PASSWORD_RESET_EXPIRY_MINUTES', 30),
      minLength: this.configService.get<number>('PASSWORD_MIN_LENGTH', 8),
      requireSpecialCharacters:
        this.configService.get<string>('PASSWORD_REQUIRE_SPECIAL', 'true') === 'true',
    };
  }

  /**
   * Rate limiting business configuration
   * Business Rule: Rate limits prevent abuse and protect system resources
   */
  getRateLimitingConfig(): {
    maxAttemptsPerEmail: number;
    maxAttemptsPerIp: number;
    lockoutDurationMinutes: number;
  } {
    return {
      maxAttemptsPerEmail: this.configService.get<number>('RATE_LIMIT_EMAIL_ATTEMPTS', 3),
      maxAttemptsPerIp: this.configService.get<number>('RATE_LIMIT_IP_ATTEMPTS', 10),
      lockoutDurationMinutes: this.configService.get<number>('RATE_LIMIT_LOCKOUT_MINUTES', 15),
    };
  }

  /**
   * File storage business configuration
   * Business Rule: File access and retention policies
   */
  getFileStorageConfig(): {
    urlExpirationHours: number;
    maxFileSize: number;
    allowedFileTypes: string[];
  } {
    return {
      urlExpirationHours: this.configService.get<number>('FILE_URL_EXPIRY_HOURS', 24),
      maxFileSize: this.configService.get<number>('MAX_FILE_SIZE_MB', 10) * 1024 * 1024,
      allowedFileTypes: this.configService
        .get<string>('ALLOWED_FILE_TYPES', 'jpg,png,pdf,doc,docx')
        .split(','),
    };
  }

  /**
   * Session management business configuration
   * Business Rule: Session policies for security and user experience
   */
  getSessionConfig(): {
    maxActiveSessions: number;
    inactivityTimeoutMinutes: number;
    extendOnActivity: boolean;
  } {
    return {
      maxActiveSessions: this.configService.get<number>('MAX_ACTIVE_SESSIONS', 3),
      inactivityTimeoutMinutes: this.configService.get<number>('SESSION_INACTIVITY_TIMEOUT', 120),
      extendOnActivity:
        this.configService.get<string>('SESSION_EXTEND_ON_ACTIVITY', 'true') === 'true',
    };
  }

  /**
   * Address and localization defaults
   * Business Rule: Default values for address information based on business requirements
   */
  getAddressDefaults(): {
    defaultCountry: string | null;
    defaultState: string | null;
    requireFullAddress: boolean;
  } {
    const defaultCountry = this.configService.get<string>('DEFAULT_COUNTRY', 'México');
    const defaultState = this.configService.get<string>('DEFAULT_STATE', 'Unknown');

    return {
      defaultCountry: defaultCountry === 'null' ? null : defaultCountry,
      defaultState: defaultState === 'null' ? null : defaultState,
      requireFullAddress:
        this.configService.get<string>('REQUIRE_FULL_ADDRESS', 'false') === 'true',
    };
  }

  /**
   * OTP (2FA) business configuration
   * Business Rule: Two-factor authentication policies
   */
  getOtpConfig(): {
    enabled: boolean;
    expirationMinutes: number;
    maxAttempts: number;
    secretLength: number;
  } {
    return {
      enabled: this.configService.get<string>('OTP_ENABLED', 'true') === 'true',
      expirationMinutes: this.configService.get<number>('OTP_EXPIRY_MINUTES', 5),
      maxAttempts: this.configService.get<number>('OTP_MAX_ATTEMPTS', 3),
      secretLength: this.configService.get<number>('OTP_SECRET_LENGTH', 32),
    };
  }

  /**
   * Business feature flags
   * Business Rule: Enable/disable features based on business requirements
   */
  getFeatureFlags(): {
    emailVerificationRequired: boolean;
    otpRequired: boolean;
    auditLoggingEnabled: boolean;
    maintenanceMode: boolean;
  } {
    return {
      emailVerificationRequired: this.getEmailVerificationConfig().enabled,
      otpRequired: this.getOtpConfig().enabled,
      auditLoggingEnabled:
        this.configService.get<string>('AUDIT_LOGGING_ENABLED', 'true') === 'true',
      maintenanceMode: this.configService.get<string>('MAINTENANCE_MODE', 'false') === 'true',
    };
  }
}
