import { DomainEvent } from './domain-event.base';
import { EntityId } from '@core/value-objects/entity-id.vo';
import { UserId } from '@core/value-objects/user-id.vo';
import { Email } from '@core/value-objects/email.vo';

/**
 * Email Verification Domain Events
 * Following DDD: Events represent significant business moments in the Email Verification lifecycle
 */

export class EmailVerificationRequestedEvent extends DomainEvent {
  constructor(
    public readonly verificationId: EntityId,
    public readonly userId: UserId,
    public readonly email: Email,
    public readonly token: string,
    public readonly expiresAt: Date,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'email_verification.requested';
  }
}

export class EmailVerificationSentEvent extends DomainEvent {
  constructor(
    public readonly verificationId: EntityId,
    public readonly userId: UserId,
    public readonly email: Email,
    public readonly sentAt: Date,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'email_verification.sent';
  }
}

export class EmailVerifiedEvent extends DomainEvent {
  constructor(
    public readonly verificationId: EntityId,
    public readonly userId: UserId,
    public readonly email: Email,
    public readonly verifiedAt: Date,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'email_verification.verified';
  }
}

export class EmailVerificationFailedEvent extends DomainEvent {
  constructor(
    public readonly verificationId: EntityId,
    public readonly userId: UserId,
    public readonly email: Email,
    public readonly reason: string,
    public readonly attemptNumber?: number,
    public readonly timestamp?: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'email_verification.failed';
  }
}

export class EmailVerificationExpiredEvent extends DomainEvent {
  constructor(
    public readonly verificationId: EntityId,
    public readonly userId: UserId,
    public readonly email: Email,
    public readonly expiredAt: Date,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'email_verification.expired';
  }
}

export class EmailVerificationResentEvent extends DomainEvent {
  constructor(
    public readonly originalVerificationId: EntityId,
    public readonly newVerificationId: EntityId,
    public readonly userId: UserId,
    public readonly email: Email,
    public readonly resentCount: number,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'email_verification.resent';
  }
}

export class EmailVerificationTokenRegeneratedEvent extends DomainEvent {
  constructor(
    public readonly verificationId: EntityId,
    public readonly userId: UserId,
    public readonly oldToken: string,
    public readonly newToken: string,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'email_verification.token_regenerated';
  }
}

export class EmailVerificationAttemptLimitExceededEvent extends DomainEvent {
  constructor(
    public readonly userId: UserId,
    public readonly email: Email,
    public readonly attemptCount: number,
    public readonly maxAttempts: number,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'email_verification.attempt_limit_exceeded';
  }
}

export class EmailVerificationCleanupPerformedEvent extends DomainEvent {
  constructor(
    public readonly expiredCount: number,
    public readonly verifiedCount: number,
    public readonly totalCleaned: number,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'email_verification.cleanup_performed';
  }
}

export class EmailChangeVerificationRequestedEvent extends DomainEvent {
  constructor(
    public readonly verificationId: EntityId,
    public readonly userId: UserId,
    public readonly oldEmail: Email,
    public readonly newEmail: Email,
    public readonly token: string,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'email_verification.change_requested';
  }
}

export class BulkEmailVerificationsSentEvent extends DomainEvent {
  constructor(
    public readonly verificationIds: EntityId[],
    public readonly count: number,
    public readonly campaign?: string,
    public readonly timestamp?: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'email_verification.bulk_sent';
  }
}
