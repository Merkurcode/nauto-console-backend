/**
 * Secure Exception Handler Utility
 *
 * **Purpose**: Centralized exception handling that prevents information disclosure
 * while maintaining debugging capabilities for development environments.
 *
 * **Security Features**:
 * - Environment-aware exception sanitization
 * - Structured error responses without sensitive data
 * - Audit trail for security-relevant exceptions
 * - Prevention of stack trace leakage in production
 * - Standardized error codes and messages
 */

import { ErrorSanitizationUtil, SanitizationLevel } from './error-sanitization.util';
import { ILogger } from '@core/interfaces/logger.interface';

export interface ISecureExceptionResponse {
  message: string;
  code: string;
  statusCode: number;
  timestamp: string;
  path?: string;
  correlationId?: string;
  details?: Record<string, unknown>;
}

export interface ISecureExceptionOptions {
  sanitizationLevel?: SanitizationLevel;
  includeStack?: boolean;
  logLevel?: 'error' | 'warn' | 'debug';
  auditRequired?: boolean;
  correlationId?: string;
  userId?: string;
  context?: string;
}

export enum SecureErrorCode {
  // Authentication & Authorization
  INVALID_CREDENTIALS = 'AUTH_001',
  ACCESS_DENIED = 'AUTH_002',
  TOKEN_EXPIRED = 'AUTH_003',
  SESSION_INVALID = 'AUTH_004',

  // Validation & Input
  INVALID_INPUT = 'INPUT_001',
  VALIDATION_FAILED = 'INPUT_002',
  MALFORMED_REQUEST = 'INPUT_003',

  // Business Logic
  BUSINESS_RULE_VIOLATION = 'BUSINESS_001',
  RESOURCE_NOT_FOUND = 'BUSINESS_002',
  OPERATION_NOT_ALLOWED = 'BUSINESS_003',
  QUOTA_EXCEEDED = 'BUSINESS_004',

  // System & Infrastructure
  SERVICE_UNAVAILABLE = 'SYSTEM_001',
  DATABASE_ERROR = 'SYSTEM_002',
  EXTERNAL_SERVICE_ERROR = 'SYSTEM_003',
  CONFIGURATION_ERROR = 'SYSTEM_004',

  // Security
  SECURITY_VIOLATION = 'SECURITY_001',
  RATE_LIMIT_EXCEEDED = 'SECURITY_002',
  SUSPICIOUS_ACTIVITY = 'SECURITY_003',
  INTEGRITY_CHECK_FAILED = 'SECURITY_004',

  // Generic
  INTERNAL_ERROR = 'INTERNAL_001',
  TIMEOUT = 'TIMEOUT_001',
  UNKNOWN_ERROR = 'UNKNOWN_001',
}

export class SecureExceptionHandler {
  private static logger?: ILogger;

  // Security: Map of safe error messages by error code
  /**
   * Set logger instance for centralized logging
   */
  static setLogger(logger: ILogger): void {
    this.logger = logger;
    this.logger.setContext('SecureExceptionHandler');
  }

  // Security: Map of safe error messages by error code
  private static readonly SAFE_ERROR_MESSAGES = new Map<SecureErrorCode, string>([
    // Authentication & Authorization
    [SecureErrorCode.INVALID_CREDENTIALS, 'The provided credentials are invalid'],
    [SecureErrorCode.ACCESS_DENIED, 'Access to this resource is denied'],
    [SecureErrorCode.TOKEN_EXPIRED, 'Authentication token has expired'],
    [SecureErrorCode.SESSION_INVALID, 'Session is no longer valid'],

    // Validation & Input
    [SecureErrorCode.INVALID_INPUT, 'The provided input is invalid'],
    [SecureErrorCode.VALIDATION_FAILED, 'Input validation failed'],
    [SecureErrorCode.MALFORMED_REQUEST, 'The request format is incorrect'],

    // Business Logic
    [SecureErrorCode.BUSINESS_RULE_VIOLATION, 'Operation violates business rules'],
    [SecureErrorCode.RESOURCE_NOT_FOUND, 'The requested resource was not found'],
    [SecureErrorCode.OPERATION_NOT_ALLOWED, 'Operation is not allowed'],
    [SecureErrorCode.QUOTA_EXCEEDED, 'Usage quota has been exceeded'],

    // System & Infrastructure
    [SecureErrorCode.SERVICE_UNAVAILABLE, 'Service is temporarily unavailable'],
    [SecureErrorCode.DATABASE_ERROR, 'Data processing error occurred'],
    [SecureErrorCode.EXTERNAL_SERVICE_ERROR, 'External service error occurred'],
    [SecureErrorCode.CONFIGURATION_ERROR, 'System configuration error'],

    // Security
    [SecureErrorCode.SECURITY_VIOLATION, 'Security policy violation detected'],
    [SecureErrorCode.RATE_LIMIT_EXCEEDED, 'Too many requests - please try again later'],
    [SecureErrorCode.SUSPICIOUS_ACTIVITY, 'Suspicious activity detected'],
    [SecureErrorCode.INTEGRITY_CHECK_FAILED, 'Data integrity check failed'],

    // Generic
    [SecureErrorCode.INTERNAL_ERROR, 'An internal error occurred'],
    [SecureErrorCode.TIMEOUT, 'Operation timed out'],
    [SecureErrorCode.UNKNOWN_ERROR, 'An unknown error occurred'],
  ]);

  /**
   * Handle exception securely with environment-appropriate response
   */
  static handleException(
    error: unknown,
    options: ISecureExceptionOptions = {},
  ): ISecureExceptionResponse {
    const {
      sanitizationLevel = ErrorSanitizationUtil.getSanitizationLevelFromEnv(),
      includeStack: _includeStack = false,
      logLevel = 'error',
      auditRequired = false,
      correlationId = this.generateCorrelationId(),
      userId,
      context = 'unknown',
    } = options;

    try {
      // Extract error information safely
      const errorInfo = this.extractErrorInfo(error);

      // Determine appropriate error code and status
      const { code, statusCode } = this.categorizeError(errorInfo);

      // Get safe message for response
      const safeMessage =
        this.SAFE_ERROR_MESSAGES.get(code) ||
        this.SAFE_ERROR_MESSAGES.get(SecureErrorCode.INTERNAL_ERROR)!;

      // Sanitize error details based on environment
      const sanitizedDetails = this.sanitizeErrorDetails(errorInfo, sanitizationLevel);

      // Log error securely
      this.logError(errorInfo, {
        code,
        correlationId,
        userId,
        context,
        logLevel,
        sanitizationLevel,
      });

      // Audit security-relevant errors
      if (auditRequired || this.requiresAudit(code)) {
        this.auditSecurityError(errorInfo, { code, correlationId, userId, context });
      }

      // Build secure response
      const response: ISecureExceptionResponse = {
        message: safeMessage,
        code,
        statusCode,
        timestamp: new Date().toISOString(),
        correlationId,
      };

      // Include sanitized details in development
      if (sanitizationLevel === SanitizationLevel.NONE && sanitizedDetails) {
        response.details = sanitizedDetails;
      }

      return response;
    } catch (handlerError) {
      // Fallback if exception handling itself fails
      const logData = {
        message: 'Critical: Exception handler failed',
        originalError: ErrorSanitizationUtil.forLogging(error, 'exception-handler-failure'),
        handlerError: ErrorSanitizationUtil.forLogging(handlerError, 'exception-handler-internal'),
        correlationId,
      };

      if (this.logger) {
        this.logger.error(logData);
      } else {
        // INTENTIONAL FALLBACK: Console logging when Logger Service is not available
        // This ensures critical exception handler failures are never lost
        console.error('[EXCEPTION_HANDLER_ERROR]', logData);
      }

      return {
        message: 'An error occurred while processing your request',
        code: SecureErrorCode.INTERNAL_ERROR,
        statusCode: 500,
        timestamp: new Date().toISOString(),
        correlationId,
      };
    }
  }

  /**
   * Extract error information safely from unknown error
   */
  private static extractErrorInfo(error: unknown): {
    message: string;
    stack?: string;
    name: string;
    statusCode?: number;
    code?: string;
    originalError: unknown;
  } {
    if (error instanceof Error) {
      return {
        message: error.message || 'Unknown error',
        stack: error.stack,
        name: error.constructor.name,
        statusCode:
          ((error as unknown as Record<string, unknown>).statusCode as number) ||
          ((error as unknown as Record<string, unknown>).status as number),
        code: (error as unknown as Record<string, unknown>).code as string,
        originalError: error,
      };
    }

    if (typeof error === 'string') {
      return {
        message: error,
        name: 'StringError',
        originalError: error,
      };
    }

    if (typeof error === 'object' && error !== null) {
      const obj = error as Record<string, unknown>;

      return {
        message: typeof obj.message === 'string' ? obj.message : obj.toString?.() || 'Object error',
        stack: typeof obj.stack === 'string' ? obj.stack : undefined,
        name: obj.constructor?.name || 'ObjectError',
        statusCode: (obj.statusCode as number) || (obj.status as number),
        code: obj.code as string,
        originalError: error,
      };
    }

    return {
      message: 'Unknown error occurred',
      name: 'UnknownError',
      originalError: error,
    };
  }

  /**
   * Categorize error to appropriate secure error code and HTTP status
   */
  private static categorizeError(errorInfo: Record<string, unknown>): {
    code: SecureErrorCode;
    statusCode: number;
  } {
    const { message, name, statusCode, code } = errorInfo;
    const lowerMessage = (typeof message === 'string' ? message : '').toLowerCase();
    const lowerName = (typeof name === 'string' ? name : '').toLowerCase();

    // Security-related errors
    if (
      lowerMessage.includes('unauthorized') ||
      lowerMessage.includes('forbidden') ||
      lowerMessage.includes('access denied') ||
      statusCode === 401 ||
      statusCode === 403
    ) {
      return { code: SecureErrorCode.ACCESS_DENIED, statusCode: 403 };
    }

    if (lowerMessage.includes('invalid credentials') || lowerMessage.includes('authentication')) {
      return { code: SecureErrorCode.INVALID_CREDENTIALS, statusCode: 401 };
    }

    if (
      lowerMessage.includes('token') &&
      (lowerMessage.includes('expired') || lowerMessage.includes('invalid'))
    ) {
      return { code: SecureErrorCode.TOKEN_EXPIRED, statusCode: 401 };
    }

    // Rate limiting
    if (
      lowerMessage.includes('rate limit') ||
      lowerMessage.includes('too many requests') ||
      statusCode === 429
    ) {
      return { code: SecureErrorCode.RATE_LIMIT_EXCEEDED, statusCode: 429 };
    }

    // Validation errors
    if (
      lowerMessage.includes('validation') ||
      lowerMessage.includes('invalid input') ||
      lowerName.includes('validation') ||
      statusCode === 400
    ) {
      return { code: SecureErrorCode.VALIDATION_FAILED, statusCode: 400 };
    }

    // Not found
    if (
      lowerMessage.includes('not found') ||
      lowerMessage.includes('does not exist') ||
      statusCode === 404
    ) {
      return { code: SecureErrorCode.RESOURCE_NOT_FOUND, statusCode: 404 };
    }

    // Timeout
    if (
      lowerMessage.includes('timeout') ||
      lowerMessage.includes('timed out') ||
      statusCode === 408
    ) {
      return { code: SecureErrorCode.TIMEOUT, statusCode: 408 };
    }

    // Service unavailable
    if (
      lowerMessage.includes('unavailable') ||
      lowerMessage.includes('service') ||
      statusCode === 503
    ) {
      return { code: SecureErrorCode.SERVICE_UNAVAILABLE, statusCode: 503 };
    }

    // Database errors
    if (
      lowerMessage.includes('database') ||
      lowerMessage.includes('connection') ||
      lowerMessage.includes('query') ||
      code === 'ECONNREFUSED'
    ) {
      return { code: SecureErrorCode.DATABASE_ERROR, statusCode: 500 };
    }

    // Configuration errors
    if (
      lowerMessage.includes('configuration') ||
      lowerMessage.includes('config') ||
      lowerMessage.includes('environment variable')
    ) {
      return { code: SecureErrorCode.CONFIGURATION_ERROR, statusCode: 500 };
    }

    // Default to internal error
    return {
      code: SecureErrorCode.INTERNAL_ERROR,
      statusCode: typeof statusCode === 'number' ? statusCode : 500,
    };
  }

  /**
   * Sanitize error details based on environment
   */
  private static sanitizeErrorDetails(
    errorInfo: Record<string, unknown>,
    level: SanitizationLevel,
  ): Record<string, unknown> | null {
    if (level === SanitizationLevel.STRICT) {
      return null; // No details in production
    }

    const details: Record<string, unknown> = {};

    if (level === SanitizationLevel.BASIC) {
      // Limited details for staging
      details.type = errorInfo.name;
      if (errorInfo.code && typeof errorInfo.code === 'string' && errorInfo.code.length < 20) {
        details.code = errorInfo.code;
      }
    } else if (level === SanitizationLevel.NONE) {
      // Full details for development
      details.type = errorInfo.name;
      details.originalMessage = ErrorSanitizationUtil.sanitizeMessage(errorInfo.message as string);
      if (errorInfo.stack) {
        details.stack = ErrorSanitizationUtil.sanitizeMessage(errorInfo.stack as string);
      }
      if (errorInfo.code) {
        details.code = errorInfo.code;
      }
    }

    return Object.keys(details).length > 0 ? details : null;
  }

  /**
   * Log error securely with appropriate level
   */
  private static logError(
    errorInfo: Record<string, unknown>,
    options: {
      code: SecureErrorCode;
      correlationId: string;
      userId?: string;
      context: string;
      logLevel: 'error' | 'warn' | 'debug';
      sanitizationLevel: SanitizationLevel;
    },
  ): void {
    const { code, correlationId, userId, context, logLevel, sanitizationLevel } = options;

    const logData = {
      correlationId,
      errorCode: code,
      context,
      userId,
      message: ErrorSanitizationUtil.sanitizeMessage(
        errorInfo.message as string,
        sanitizationLevel,
      ),
      errorType: errorInfo.name,
      timestamp: new Date().toISOString(),
    };

    // Include stack in development
    if (sanitizationLevel === SanitizationLevel.NONE && errorInfo.stack) {
      logData['stack'] = ErrorSanitizationUtil.sanitizeMessage(
        errorInfo.stack as string,
        sanitizationLevel,
      );
    }

    if (this.logger) {
      switch (logLevel) {
        case 'error':
          this.logger.error(logData);
          break;
        case 'warn':
          this.logger.warn(logData);
          break;
        case 'debug':
          this.logger.debug(logData);
          break;
      }
    } else {
      // INTENTIONAL FALLBACK: Console logging when Logger Service is not available
      console.error('[SECURE_EXCEPTION_HANDLER]', logData);
    }
  }

  /**
   * Audit security-relevant errors
   */
  private static auditSecurityError(
    errorInfo: Record<string, unknown>,
    options: {
      code: SecureErrorCode;
      correlationId: string;
      userId?: string;
      context: string;
    },
  ): void {
    // This would integrate with the audit log system
    // For now, just ensure it's logged as a security event
    const auditData = {
      event: 'SECURITY_ERROR',
      correlationId: options.correlationId,
      errorCode: options.code,
      context: options.context,
      userId: options.userId,
      sanitizedMessage: ErrorSanitizationUtil.sanitizeMessage(errorInfo.message as string),
      timestamp: new Date().toISOString(),
    };

    if (this.logger) {
      this.logger.warn(auditData);
    } else {
      // INTENTIONAL FALLBACK: Console logging when Logger Service is not available
      console.warn('[SECURITY_AUDIT]', auditData);
    }
  }

  /**
   * Check if error requires security audit
   */
  private static requiresAudit(code: SecureErrorCode): boolean {
    const auditRequiredCodes = [
      SecureErrorCode.SECURITY_VIOLATION,
      SecureErrorCode.SUSPICIOUS_ACTIVITY,
      SecureErrorCode.RATE_LIMIT_EXCEEDED,
      SecureErrorCode.INTEGRITY_CHECK_FAILED,
      SecureErrorCode.ACCESS_DENIED,
    ];

    return auditRequiredCodes.includes(code);
  }

  /**
   * Generate correlation ID for error tracking
   */
  private static generateCorrelationId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create standardized HTTP exception with secure error handling
   */
  static createHttpException(
    error: unknown,
    defaultStatusCode: number = 500,
    options: ISecureExceptionOptions = {},
  ): Record<string, unknown> {
    const secureResponse = this.handleException(error, {
      ...options,
      auditRequired: true,
    });

    // Return object that can be used with NestJS HttpException
    return {
      message: secureResponse.message,
      statusCode: secureResponse.statusCode || defaultStatusCode,
      error: secureResponse.code,
      timestamp: secureResponse.timestamp,
      correlationId: secureResponse.correlationId,
      ...(secureResponse.details && { details: secureResponse.details }),
    };
  }
}
