import { DomainEvent } from './domain-event.base';
import { EntityId } from '@core/value-objects/entity-id.vo';
import { UserId } from '@core/value-objects/user-id.vo';
import { Email } from '@core/value-objects/email.vo';

/**
 * Password Reset Attempt Domain Events
 * Following DDD: Events represent significant business moments in the Password Reset Attempt lifecycle
 */

export class PasswordResetAttemptCreatedEvent extends DomainEvent {
  constructor(
    public readonly attemptId: EntityId,
    public readonly resetId: EntityId,
    public readonly userId: UserId,
    public readonly email: Email,
    public readonly ipAddress: string,
    public readonly userAgent: string,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'password_reset_attempt.created';
  }
}

export class PasswordResetAttemptSucceededEvent extends DomainEvent {
  constructor(
    public readonly attemptId: EntityId,
    public readonly resetId: EntityId,
    public readonly userId: UserId,
    public readonly completedAt: Date,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'password_reset_attempt.succeeded';
  }
}

export class PasswordResetAttemptFailedEvent extends DomainEvent {
  constructor(
    public readonly attemptId: EntityId,
    public readonly resetId: EntityId,
    public readonly userId: UserId,
    public readonly reason: string,
    public readonly failedAt: Date,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'password_reset_attempt.failed';
  }
}

export class PasswordResetAttemptBlockedEvent extends DomainEvent {
  constructor(
    public readonly attemptId: EntityId,
    public readonly resetId: EntityId,
    public readonly userId: UserId,
    public readonly reason: string,
    public readonly blockedUntil: Date,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'password_reset_attempt.blocked';
  }
}

export class PasswordResetAttemptSuspiciousActivityEvent extends DomainEvent {
  constructor(
    public readonly attemptId: EntityId,
    public readonly resetId: EntityId,
    public readonly userId: UserId,
    public readonly activityType: string,
    public readonly details: Record<string, unknown>,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'password_reset_attempt.suspicious_activity';
  }
}

export class PasswordResetAttemptCleanupPerformedEvent extends DomainEvent {
  constructor(
    public readonly expiredCount: number,
    public readonly completedCount: number,
    public readonly totalCleaned: number,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'password_reset_attempt.cleanup_performed';
  }
}
