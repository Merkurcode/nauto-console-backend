import { DomainEvent } from './domain-event.base';
import { EntityId } from '@core/value-objects/entity-id.vo';
import { UserId } from '@core/value-objects/user-id.vo';
import { Email } from '@core/value-objects/email.vo';

/**
 * OTP Domain Events
 * Following DDD: Events represent significant business moments in the OTP lifecycle
 */

export class OTPGeneratedEvent extends DomainEvent {
  constructor(
    public readonly otpId: EntityId,
    public readonly userId: UserId,
    public readonly email: Email,
    public readonly code: string,
    public readonly expiresAt: Date,
    public readonly purpose: string,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'otp.generated';
  }
}

export class OTPSentEvent extends DomainEvent {
  constructor(
    public readonly otpId: EntityId,
    public readonly userId: UserId,
    public readonly email: Email,
    public readonly sentAt: Date,
    public readonly deliveryMethod: 'email' | 'sms',
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'otp.sent';
  }
}

export class OTPVerifiedEvent extends DomainEvent {
  constructor(
    public readonly otpId: EntityId,
    public readonly userId: UserId,
    public readonly verifiedAt: Date,
    public readonly purpose: string,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'otp.verified';
  }
}

export class OTPVerificationFailedEvent extends DomainEvent {
  constructor(
    public readonly otpId: EntityId,
    public readonly userId: UserId,
    public readonly attemptedCode: string,
    public readonly reason: string,
    public readonly attemptNumber: number,
    public readonly ipAddress: string,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'otp.verification_failed';
  }
}

export class OTPExpiredEvent extends DomainEvent {
  constructor(
    public readonly otpId: EntityId,
    public readonly userId: UserId,
    public readonly expiredAt: Date,
    public readonly purpose: string,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'otp.expired';
  }
}

export class OTPInvalidatedEvent extends DomainEvent {
  constructor(
    public readonly otpId: EntityId,
    public readonly userId: UserId,
    public readonly reason: string,
    public readonly invalidatedBy?: UserId,
    public readonly timestamp?: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'otp.invalidated';
  }
}

export class OTPResendRequestedEvent extends DomainEvent {
  constructor(
    public readonly originalOtpId: EntityId,
    public readonly newOtpId: EntityId,
    public readonly userId: UserId,
    public readonly resendCount: number,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'otp.resend_requested';
  }
}

export class OTPAttemptLimitExceededEvent extends DomainEvent {
  constructor(
    public readonly otpId: EntityId,
    public readonly userId: UserId,
    public readonly attemptCount: number,
    public readonly maxAttempts: number,
    public readonly blockDuration: number,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'otp.attempt_limit_exceeded';
  }
}

export class OTPRateLimitExceededEvent extends DomainEvent {
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
    return 'otp.rate_limit_exceeded';
  }
}

export class OTPSecurityAlertEvent extends DomainEvent {
  constructor(
    public readonly otpId: EntityId,
    public readonly userId: UserId,
    public readonly alertType: 'brute_force_attempt' | 'unusual_pattern' | 'multiple_failures',
    public readonly details: Record<string, unknown>,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'otp.security_alert';
  }
}

export class OTPCleanupPerformedEvent extends DomainEvent {
  constructor(
    public readonly expiredCount: number,
    public readonly verifiedCount: number,
    public readonly invalidatedCount: number,
    public readonly totalCleaned: number,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'otp.cleanup_performed';
  }
}

export class BulkOTPsGeneratedEvent extends DomainEvent {
  constructor(
    public readonly otpIds: EntityId[],
    public readonly count: number,
    public readonly purpose: string,
    public readonly batchId?: string,
    public readonly timestamp?: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'otp.bulk_generated';
  }
}
