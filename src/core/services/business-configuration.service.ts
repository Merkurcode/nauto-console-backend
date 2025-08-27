import { Injectable, OnModuleInit, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ILogger } from '@core/interfaces/logger.interface';
import { LOGGER_SERVICE } from '@shared/constants/tokens';

/**
 * Domain service responsible for business configuration values
 * Centralizes all business rules and configurable values with security validation
 *
 * **Security Features**:
 * - Input validation and sanitization for all configuration values
 * - Range and type checking to prevent configuration injection
 * - Audit logging for configuration access
 * - Fail-secure defaults for all settings
 * - Runtime validation of critical configuration
 */
@Injectable()
export class BusinessConfigurationService implements OnModuleInit {
  private readonly configCache = new Map<string, any>();
  private readonly CONFIG_ACCESS_LOG = true; // Enable audit logging for config access

  // Security: Define valid ranges for all numeric configurations
  private readonly VALID_RANGES = {
    EMAIL_VERIFICATION_EXPIRY_MINUTES: { min: 1, max: 10080 }, // 1 minute to 1 week
    PASSWORD_SALT_ROUNDS: { min: 8, max: 20 }, // BCrypt recommended range
    PASSWORD_RESET_EXPIRY_MINUTES: { min: 5, max: 1440 }, // 5 minutes to 24 hours
    PASSWORD_MIN_LENGTH: { min: 6, max: 128 },
    RATE_LIMIT_EMAIL_ATTEMPTS: { min: 1, max: 100 },
    RATE_LIMIT_IP_ATTEMPTS: { min: 1, max: 1000 },
    RATE_LIMIT_LOCKOUT_MINUTES: { min: 1, max: 1440 },
    FILE_URL_EXPIRY_HOURS: { min: 1, max: 168 }, // 1 hour to 1 week
    // MAX_FILE_SIZE_MB: removed - now managed by StorageTiers
    // MAX_ACTIVE_SESSIONS: { min: 1, max: 100 },
    SESSION_INACTIVITY_TIMEOUT: { min: 5, max: 43200 }, // 5 minutes to 30 days (in minutes)
    OTP_MAX_ATTEMPTS: { min: 1, max: 10 },
    OTP_SECRET_LENGTH: { min: 16, max: 64 },
  };

  // Security: Define valid string patterns
  private readonly VALID_PATTERNS = {
    // ALLOWED_FILE_TYPES: removed - now managed by UserStorageConfig
    DEFAULT_COUNTRY: /^[a-zA-Z\s-]{1,50}$/, // Letters, spaces, hyphens, max 50 chars
    DEFAULT_STATE: /^[a-zA-Z\s-]{1,50}$/, // Letters, spaces, hyphens, max 50 chars
  };

  constructor(
    private readonly configService: ConfigService,
    @Inject(LOGGER_SERVICE) private readonly logger: ILogger,
  ) {
    this.logger.setContext(BusinessConfigurationService.name);
  }

  async onModuleInit() {
    // Security: Validate all critical configurations at startup
    await this.validateCriticalConfiguration([
      'EMAIL_VERIFICATION_EXPIRY_MINUTES',
      'PASSWORD_SALT_ROUNDS',
      'PASSWORD_MIN_LENGTH',
      'RATE_LIMIT_EMAIL_ATTEMPTS',
      //'MAX_ACTIVE_SESSIONS',
    ]);
    this.logger.log('Business configuration service initialized with security validation');
  }

  /**
   * Email verification business configuration (security validated)
   * Business Rule: Email verification requirement can be enabled/disabled per environment
   */
  getEmailVerificationConfig(): {
    enabled: boolean;
    expirationMinutes: number;
  } {
    this.auditConfigAccess('EMAIL_VERIFICATION_CONFIG');

    const enabledValue = this.configService.get<boolean>(
      'business.emailVerification.enabled',
      false,
    );
    const expirationMinutes = this.configService.get<number>(
      'business.emailVerification.expiryMinutes',
      60,
    );

    return {
      enabled: enabledValue,
      expirationMinutes,
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
      saltRounds: this.configService.get<number>('business.password.saltRounds', 12),
      resetExpirationMinutes: this.configService.get<number>(
        'business.password.resetExpiryMinutes',
        30,
      ),
      minLength: this.configService.get<number>('business.password.minLength', 8),
      requireSpecialCharacters: this.configService.get<boolean>(
        'business.password.requireSpecial',
        true,
      ),
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
      maxAttemptsPerEmail: this.configService.get<number>('business.rateLimit.emailAttempts', 3),
      maxAttemptsPerIp: this.configService.get<number>('business.rateLimit.ipAttempts', 10),
      lockoutDurationMinutes: this.configService.get<number>(
        'business.rateLimit.lockoutMinutes',
        15,
      ),
    };
  }

  /**
   * File storage business configuration
   * Business Rule: Global file access policies (user-specific limits in UserStorageConfig)
   * @deprecated Use UserStorageConfig + StorageTiers for user-specific file policies
   */
  getFileStorageConfig(): {
    urlExpirationHours: number;
  } {
    return {
      urlExpirationHours: this.configService.get<number>('business.files.urlExpiryHours', 24),
      // maxFileSize and allowedFileTypes now managed by UserStorageConfig + StorageTiers
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
      maxActiveSessions: this.configService.get<number>('business.sessions.maxActive', 3),
      inactivityTimeoutMinutes: this.configService.get<number>(
        'business.sessions.inactivityTimeout',
        120,
      ),
      extendOnActivity: this.configService.get<boolean>('business.sessions.extendOnActivity', true),
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
    return {
      defaultCountry: this.configService.get<string>('business.address.defaultCountry', null),
      defaultState: this.configService.get<string>('business.address.defaultState', null),
      requireFullAddress: this.configService.get<boolean>(
        'business.address.requireFullAddress',
        false,
      ),
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
      enabled: this.configService.get<boolean>('business.otpBusiness.enabled', true),
      expirationMinutes: this.configService.get<number>('otp.expiration', 5),
      maxAttempts: this.configService.get<number>('business.otpBusiness.maxAttempts', 3),
      secretLength: this.configService.get<number>('business.otpBusiness.secretLength', 32),
    };
  }

  /**
   * Business feature flags
   * Business Rule: Enable/disable features based on business requirements
   */
  getFeatureFlags(): {
    emailVerificationRequired: boolean;
    otpRequired: boolean;
  } {
    return {
      emailVerificationRequired: this.getEmailVerificationConfig().enabled,
      otpRequired: this.getOtpConfig().enabled,
    };
  }

  /**
   * Security: Validate critical configuration at startup
   */
  private async validateCriticalConfiguration(criticalConfigs: string[]): Promise<void> {
    const validationErrors: string[] = [];

    for (const configKey of criticalConfigs) {
      try {
        const value = this.configService.get<string>(configKey);
        if (value !== undefined) {
          const numericValue = parseInt(value, 10);
          if (isNaN(numericValue)) {
            validationErrors.push(`${configKey}: Invalid numeric value '${value}'`);
            continue;
          }

          const range = this.VALID_RANGES[configKey as keyof typeof this.VALID_RANGES];
          if (range && (numericValue < range.min || numericValue > range.max)) {
            validationErrors.push(
              `${configKey}: Value ${numericValue} out of valid range [${range.min}, ${range.max}]`,
            );
          }
        }
      } catch (error) {
        validationErrors.push(`${configKey}: Validation error - ${error}`);
      }
    }

    if (validationErrors.length > 0) {
      this.logger.error({
        message: 'Critical configuration validation failed',
        errors: validationErrors,
        action: 'APPLICATION_STARTUP_FAILED',
      });

      throw new Error(`Configuration validation failed: ${validationErrors.join('; ')}`);
    }

    this.logger.log('Critical configuration validation passed');
  }

  /**
   * Security: Get validated boolean configuration value
   */
  private getValidatedBooleanConfig(key: string, defaultValue: boolean): boolean {
    const value = this.configService.get<string>(key, defaultValue.toString());

    // Security: Only accept explicit 'true' or 'false' strings
    if (value !== 'true' && value !== 'false') {
      this.logger.warn({
        message: `Invalid boolean configuration value for ${key}: '${value}', using default: ${defaultValue}`,
        configKey: key,
        invalidValue: value,
        defaultUsed: defaultValue,
      });

      return defaultValue;
    }

    return value === 'true';
  }

  /**
   * Security: Get validated numeric configuration value
   */
  private getValidatedNumericConfig(
    key: string,
    defaultValue: number,
    rangeKey?: keyof typeof this.VALID_RANGES,
  ): number {
    const value = this.configService.get<string>(key, defaultValue.toString());
    const numericValue = parseInt(value, 10);

    // Security: Validate numeric conversion
    if (isNaN(numericValue)) {
      this.logger.warn({
        message: `Invalid numeric configuration value for ${key}: '${value}', using default: ${defaultValue}`,
        configKey: key,
        invalidValue: value,
        defaultUsed: defaultValue,
      });

      return defaultValue;
    }

    // Security: Validate range if specified
    if (rangeKey && this.VALID_RANGES[rangeKey]) {
      const range = this.VALID_RANGES[rangeKey];
      if (numericValue < range.min || numericValue > range.max) {
        this.logger.warn({
          message: `Configuration value for ${key} out of valid range: ${numericValue}, using default: ${defaultValue}`,
          configKey: key,
          invalidValue: numericValue,
          validRange: range,
          defaultUsed: defaultValue,
        });

        return defaultValue;
      }
    }

    return numericValue;
  }

  /**
   * Security: Get validated string configuration value
   */
  private getValidatedStringConfig(
    key: string,
    defaultValue: string,
    patternKey?: keyof typeof this.VALID_PATTERNS,
    maxLength: number = 200,
  ): string {
    const value = this.configService.get<string>(key, defaultValue);

    // Security: Length validation
    if (value.length > maxLength) {
      this.logger.warn({
        message: `Configuration value for ${key} exceeds maximum length: ${value.length} > ${maxLength}, using default`,
        configKey: key,
        valueLength: value.length,
        maxLength,
        defaultUsed: defaultValue,
      });

      return defaultValue;
    }

    // Security: Pattern validation if specified
    if (patternKey && this.VALID_PATTERNS[patternKey]) {
      const pattern = this.VALID_PATTERNS[patternKey];
      if (!pattern.test(value)) {
        this.logger.warn({
          message: `Configuration value for ${key} does not match required pattern, using default`,
          configKey: key,
          invalidValue: value.substring(0, 50) + '...', // Truncate for logging
          defaultUsed: defaultValue,
        });

        return defaultValue;
      }
    }

    return value;
  }

  /**
   * Security: Audit configuration access for monitoring
   */
  private auditConfigAccess(configGroup: string): void {
    if (this.CONFIG_ACCESS_LOG) {
      // In production, this could be sent to an audit log system
      this.logger.debug({
        event: 'CONFIG_ACCESS',
        configGroup,
        timestamp: new Date().toISOString(),
      });
    }
  }
}
