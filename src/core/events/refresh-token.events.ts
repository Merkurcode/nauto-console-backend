import { DomainEvent } from './domain-event.base';
import { EntityId } from '@core/value-objects/entity-id.vo';
import { UserId } from '@core/value-objects/user-id.vo';
import { SessionId } from '@core/value-objects/session-id.vo';

/**
 * Refresh Token Domain Events
 * Following DDD: Events represent significant business moments in the Refresh Token lifecycle
 */

export class RefreshTokenIssuedEvent extends DomainEvent {
  constructor(
    public readonly tokenId: EntityId,
    public readonly userId: UserId,
    public readonly sessionId: SessionId,
    public readonly expiresAt: Date,
    public readonly deviceInfo?: string,
    public readonly timestamp?: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'refresh_token.issued';
  }
}

export class RefreshTokenUsedEvent extends DomainEvent {
  constructor(
    public readonly tokenId: EntityId,
    public readonly userId: UserId,
    public readonly newTokenId: EntityId,
    public readonly ipAddress: string,
    public readonly userAgent?: string,
    public readonly timestamp?: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'refresh_token.used';
  }
}

export class RefreshTokenRotatedEvent extends DomainEvent {
  constructor(
    public readonly oldTokenId: EntityId,
    public readonly newTokenId: EntityId,
    public readonly userId: UserId,
    public readonly sessionId: SessionId,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'refresh_token.rotated';
  }
}

export class RefreshTokenRevokedEvent extends DomainEvent {
  constructor(
    public readonly tokenId: EntityId,
    public readonly userId: UserId,
    public readonly reason: string,
    public readonly revokedBy?: UserId,
    public readonly timestamp?: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'refresh_token.revoked';
  }
}

export class RefreshTokenExpiredEvent extends DomainEvent {
  constructor(
    public readonly tokenId: EntityId,
    public readonly userId: UserId,
    public readonly expiredAt: Date,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'refresh_token.expired';
  }
}

export class RefreshTokenReuseAttemptedEvent extends DomainEvent {
  constructor(
    public readonly tokenId: EntityId,
    public readonly userId: UserId,
    public readonly attemptedAt: Date,
    public readonly ipAddress: string,
    public readonly userAgent?: string,
    public readonly timestamp?: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'refresh_token.reuse_attempted';
  }
}

export class RefreshTokenFamilyRevokedEvent extends DomainEvent {
  constructor(
    public readonly familyId: string,
    public readonly userId: UserId,
    public readonly tokenCount: number,
    public readonly reason: string,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'refresh_token.family_revoked';
  }
}

export class RefreshTokenValidatedEvent extends DomainEvent {
  constructor(
    public readonly tokenId: EntityId,
    public readonly userId: UserId,
    public readonly validationResult: boolean,
    public readonly failureReason?: string,
    public readonly timestamp?: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'refresh_token.validated';
  }
}

export class RefreshTokenCleanupPerformedEvent extends DomainEvent {
  constructor(
    public readonly expiredCount: number,
    public readonly revokedCount: number,
    public readonly unusedCount: number,
    public readonly totalCleaned: number,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'refresh_token.cleanup_performed';
  }
}

export class RefreshTokenSuspiciousActivityDetectedEvent extends DomainEvent {
  constructor(
    public readonly tokenId: EntityId,
    public readonly userId: UserId,
    public readonly activityType:
      | 'rapid_rotation'
      | 'multiple_devices'
      | 'geographic_anomaly'
      | 'reuse_attempt',
    public readonly details: Record<string, unknown>,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'refresh_token.suspicious_activity_detected';
  }
}

export class UserRefreshTokensRevokedEvent extends DomainEvent {
  constructor(
    public readonly userId: UserId,
    public readonly tokenIds: EntityId[],
    public readonly count: number,
    public readonly reason: string,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'refresh_token.user_tokens_revoked';
  }
}

export class RefreshTokenExtendedEvent extends DomainEvent {
  constructor(
    public readonly tokenId: EntityId,
    public readonly userId: UserId,
    public readonly previousExpiry: Date,
    public readonly newExpiry: Date,
    public readonly extendedBy: UserId,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'refresh_token.extended';
  }
}
