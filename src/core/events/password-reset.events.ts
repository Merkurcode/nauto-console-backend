import { DomainEvent } from './domain-event.base';
import { EntityId } from '@core/value-objects/entity-id.vo';
import { UserId } from '@core/value-objects/user-id.vo';
import { Email } from '@core/value-objects/email.vo';

/**
 * Password Reset Domain Events
 * Following DDD: Events represent significant business moments in the Password Reset lifecycle
 */

export class PasswordResetRequestedEvent extends DomainEvent {
  constructor(
    public readonly resetId: EntityId,
    public readonly userId: UserId,
    public readonly email: Email,
    public readonly ipAddress: string,
    public readonly expiresAt: Date,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'password_reset.requested';
  }
}

export class PasswordResetEmailSentEvent extends DomainEvent {
  constructor(
    public readonly resetId: EntityId,
    public readonly userId: UserId,
    public readonly email: Email,
    public readonly sentAt: Date,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'password_reset.email_sent';
  }
}

export class PasswordResetCompletedEvent extends DomainEvent {
  constructor(
    public readonly resetId: EntityId,
    public readonly userId: UserId,
    public readonly resetAt: Date,
    public readonly ipAddress: string,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'password_reset.completed';
  }
}

export class PasswordResetFailedEvent extends DomainEvent {
  constructor(
    public readonly resetId: EntityId,
    public readonly userId: UserId,
    public readonly reason: string,
    public readonly attemptNumber: number,
    public readonly ipAddress: string,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'password_reset.failed';
  }
}

export class PasswordResetExpiredEvent extends DomainEvent {
  constructor(
    public readonly resetId: EntityId,
    public readonly userId: UserId,
    public readonly expiredAt: Date,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'password_reset.expired';
  }
}

export class PasswordResetTokenVerifiedEvent extends DomainEvent {
  constructor(
    public readonly resetId: EntityId,
    public readonly userId: UserId,
    public readonly verifiedAt: Date,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'password_reset.token_verified';
  }
}

export class PasswordResetTokenInvalidatedEvent extends DomainEvent {
  constructor(
    public readonly resetId: EntityId,
    public readonly userId: UserId,
    public readonly reason: string,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'password_reset.token_invalidated';
  }
}

export class PasswordResetAttemptLimitExceededEvent extends DomainEvent {
  constructor(
    public readonly userId: UserId,
    public readonly email: Email,
    public readonly attemptCount: number,
    public readonly maxAttempts: number,
    public readonly blockDuration: number,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'password_reset.attempt_limit_exceeded';
  }
}

export class PasswordResetRateLimitExceededEvent extends DomainEvent {
  constructor(
    public readonly userId: UserId,
    public readonly ipAddress: string,
    public readonly requestCount: number,
    public readonly timeWindow: number,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'password_reset.rate_limit_exceeded';
  }
}

export class PasswordResetSecurityAlertEvent extends DomainEvent {
  constructor(
    public readonly userId: UserId,
    public readonly alertType: 'suspicious_activity' | 'multiple_requests' | 'different_location',
    public readonly details: Record<string, unknown>,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'password_reset.security_alert';
  }
}

export class PasswordResetCleanupPerformedEvent extends DomainEvent {
  constructor(
    public readonly expiredCount: number,
    public readonly completedCount: number,
    public readonly totalCleaned: number,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'password_reset.cleanup_performed';
  }
}

export class AdminPasswordResetInitiatedEvent extends DomainEvent {
  constructor(
    public readonly resetId: EntityId,
    public readonly targetUserId: UserId,
    public readonly adminUserId: UserId,
    public readonly reason: string,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'password_reset.admin_initiated';
  }
}
