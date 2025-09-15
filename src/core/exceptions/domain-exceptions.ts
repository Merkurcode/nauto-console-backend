// Pure domain exceptions without HTTP dependencies
// These exceptions represent business rule violations and domain errors
// HTTP status mapping is handled in the presentation layer

/**
 * Base domain exception class
 * All domain exceptions extend from this base class
 */
export abstract class DomainException extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;

    // Capture stack trace if available
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

// Entity exceptions
export class EntityNotFoundException extends DomainException {
  constructor(entityName: string, id?: string) {
    const message = id ? `${entityName} with ID ${id} not found` : `${entityName} not found`;
    super(message, 'ENTITY_NOT_FOUND', { entityName, id });
  }
}

export class EntityAlreadyExistsException extends DomainException {
  constructor(entityName: string, identifier?: string) {
    const message = identifier
      ? `${entityName} with this ${identifier} already exists`
      : `${entityName} already exists`;
    super(message, 'ENTITY_ALREADY_EXISTS', { entityName, identifier });
  }
}

export class DuplicateEntityException extends DomainException {
  constructor(entityName: string, field: string, value: string) {
    const message = `${entityName} with ${field} '${value}' already exists`;
    super(message, 'DUPLICATE_ENTITY', { entityName, field, value });
  }
}

// Input validation exceptions
export class InvalidInputException extends DomainException {
  constructor(message: string, field?: string) {
    super(message, 'INVALID_INPUT', { field });
  }
}

export class InvalidParameterException extends DomainException {
  constructor(parameterName: string, value: string, reason: string) {
    super(
      `Invalid parameter '${parameterName}' with value '${value}': ${reason}`,
      'INVALID_PARAMETER',
      {
        parameterName,
        value,
        reason,
      },
    );
  }
}

export class InvalidValueObjectException extends DomainException {
  constructor(message: string, valueObjectType?: string) {
    super(message, 'INVALID_VALUE_OBJECT', { valueObjectType });
  }
}

export class InvalidMultilingualFieldException extends DomainException {
  constructor(message: string, language?: string) {
    super(message, 'INVALID_MULTILINGUAL_FIELD', { language });
  }
}

// Authentication exceptions
export class AuthenticationException extends DomainException {
  constructor(message: string) {
    super(message, 'AUTHENTICATION_FAILED');
  }
}

export class InvalidCredentialsException extends DomainException {
  constructor() {
    super('Invalid credentials provided', 'INVALID_CREDENTIALS');
  }
}

export class AccountLockedException extends DomainException {
  constructor(reason?: string) {
    super('Account is locked', 'ACCOUNT_LOCKED', { reason });
  }
}

export class TwoFactorRequiredException extends DomainException {
  constructor() {
    super('Two-factor authentication required', 'TWO_FACTOR_REQUIRED');
  }
}

export class InvalidSessionException extends DomainException {
  constructor(message: string = 'Invalid or expired session') {
    super(message, 'INVALID_SESSION');
  }
}

// Authorization exceptions
export class ForbiddenActionException extends DomainException {
  constructor(message: string, action?: string, resource?: string) {
    super(message, 'FORBIDDEN_ACTION', { action, resource });
  }
}

export class InsufficientPermissionsException extends DomainException {
  constructor(requiredPermission: string, resource?: string) {
    super(`Insufficient permissions: ${requiredPermission} required`, 'INSUFFICIENT_PERMISSIONS', {
      requiredPermission,
      resource,
    });
  }
}

// OTP exceptions
export class OtpExpiredException extends DomainException {
  constructor() {
    super('OTP has expired', 'OTP_EXPIRED');
  }
}

export class OtpInvalidException extends DomainException {
  constructor() {
    super('Invalid OTP', 'OTP_INVALID');
  }
}

// Rate limiting exceptions
export class RateLimitExceededException extends DomainException {
  constructor(message: string, retryAfter?: number) {
    super(message, 'RATE_LIMIT_EXCEEDED', { retryAfter });
  }
}

export class ThrottlingException extends DomainException {
  constructor(message: string, identifier?: string) {
    super(message, 'THROTTLING_VIOLATION', { identifier });
  }
}

export class InvalidThrottleIdentifierException extends DomainException {
  constructor() {
    super('Throttle identifier cannot be empty', 'INVALID_THROTTLE_IDENTIFIER');
  }
}

// Business rule violations
export class BusinessRuleValidationException extends DomainException {
  constructor(message: string, rule?: string) {
    super(message, 'BUSINESS_RULE_VIOLATION', { rule });
  }
}

// Domain-specific exception hierarchies
export abstract class UserDomainException extends DomainException {}
export abstract class RoleDomainException extends DomainException {}
export abstract class AuthenticationDomainException extends DomainException {}
export abstract class FileDomainException extends DomainException {}

// User domain exceptions
export class UserNotEligibleForRoleException extends UserDomainException {
  constructor(userId: string, roleName: string) {
    super(`User ${userId} is not eligible for role: ${roleName}`, 'USER_NOT_ELIGIBLE_FOR_ROLE', {
      userId,
      roleName,
    });
  }
}

export class UserAlreadyHasRoleException extends UserDomainException {
  constructor(userId: string, roleName: string) {
    super(`User ${userId} already has role: ${roleName}`, 'USER_ALREADY_HAS_ROLE', {
      userId,
      roleName,
    });
  }
}

export class InactiveUserException extends UserDomainException {
  constructor(operation: string, userId?: string) {
    super(`Cannot ${operation} for inactive user`, 'INACTIVE_USER', { operation, userId });
  }
}

export class UserCannotRemoveLastRoleException extends UserDomainException {
  constructor(userId?: string) {
    super('Cannot remove the last role from user', 'CANNOT_REMOVE_LAST_ROLE', { userId });
  }
}

export class UserBannedException extends UserDomainException {
  constructor(
    public readonly bannedUntil: Date,
    public readonly banReason: string,
    userId?: string,
  ) {
    super(
      `User is banned until ${bannedUntil.toISOString()}. Reason: ${banReason}`,
      'USER_BANNED',
      {
        userId,
        bannedUntil: bannedUntil.toISOString(),
        banReason,
      },
    );
  }
}

// Role domain exceptions
export class CannotDeleteDefaultRoleException extends RoleDomainException {
  constructor(roleName?: string) {
    super('Cannot delete default role', 'CANNOT_DELETE_DEFAULT_ROLE', { roleName });
  }
}

export class RoleHasAssignedUsersException extends RoleDomainException {
  constructor(roleName: string, userCount?: number) {
    super(`Cannot delete role ${roleName} as it has assigned users`, 'ROLE_HAS_ASSIGNED_USERS', {
      roleName,
      userCount,
    });
  }
}

export class PermissionAlreadyAssignedException extends RoleDomainException {
  constructor(permissionName: string, roleName: string) {
    super(
      `Permission ${permissionName} is already assigned to role ${roleName}`,
      'PERMISSION_ALREADY_ASSIGNED',
      { permissionName, roleName },
    );
  }
}

// File domain exceptions
export class FileNotOwnedByUserException extends FileDomainException {
  constructor(fileId: string, userId: string) {
    super(`File ${fileId} is not owned by user ${userId}`, 'FILE_NOT_OWNED_BY_USER', {
      fileId,
      userId,
    });
  }
}

export class FileAccessDeniedException extends FileDomainException {
  constructor(fileId: string, userId?: string) {
    super(`Access denied to file ${fileId}`, 'FILE_ACCESS_DENIED', { fileId, userId });
  }
}

export class InvalidFileOperationException extends FileDomainException {
  constructor(operation: string, reason: string, fileId?: string) {
    super(`Cannot ${operation}: ${reason}`, 'INVALID_FILE_OPERATION', {
      operation,
      reason,
      fileId,
    });
  }
}

// System exceptions
export class HealthCheckException extends DomainException {
  constructor(message: string, component?: string) {
    super(message, 'HEALTH_CHECK_FAILED', { component });
  }
}

export class DatabaseConnectionException extends HealthCheckException {
  constructor(message: string) {
    super(`Database connection error: ${message}`, 'DATABASE_CONNECTION_FAILED');
  }
}

export class ConfigurationException extends DomainException {
  constructor(message: string, configKey?: string) {
    super(`Configuration error: ${message}`, 'CONFIGURATION_ERROR', { configKey });
  }
}
