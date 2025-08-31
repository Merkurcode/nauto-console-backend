import { DomainEvent } from './domain-event.base';
import { BotTokenId } from '@core/value-objects/bot-token-id.vo';
import { UserId } from '@core/value-objects/user-id.vo';
import { CompanyId } from '@core/value-objects/company-id.vo';

/**
 * Bot Token Domain Events
 * Following DDD: Events represent significant business moments in the Bot Token lifecycle
 */

export class BotTokenGeneratedEvent extends DomainEvent {
  constructor(
    public readonly tokenId: BotTokenId,
    public readonly botUserId: UserId,
    public readonly companyId: CompanyId,
    public readonly tokenName: string,
    public readonly expiresAt?: Date,
    public readonly timestamp?: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'bot_token.generated';
  }
}

export class BotTokenRevokedEvent extends DomainEvent {
  constructor(
    public readonly tokenId: BotTokenId,
    public readonly botUserId: UserId,
    public readonly revokedBy: UserId,
    public readonly reason?: string,
    public readonly timestamp?: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'bot_token.revoked';
  }
}

export class BotTokenExpiredEvent extends DomainEvent {
  constructor(
    public readonly tokenId: BotTokenId,
    public readonly botUserId: UserId,
    public readonly expiredAt: Date,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'bot_token.expired';
  }
}

export class BotTokenUsedEvent extends DomainEvent {
  constructor(
    public readonly tokenId: BotTokenId,
    public readonly botUserId: UserId,
    public readonly ipAddress: string,
    public readonly userAgent?: string,
    public readonly timestamp?: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'bot_token.used';
  }
}

export class BotTokenRefreshedEvent extends DomainEvent {
  constructor(
    public readonly oldTokenId: BotTokenId,
    public readonly newTokenId: BotTokenId,
    public readonly botUserId: UserId,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'bot_token.refreshed';
  }
}

export class BotTokenValidatedEvent extends DomainEvent {
  constructor(
    public readonly tokenId: BotTokenId,
    public readonly botUserId: UserId,
    public readonly validationResult: boolean,
    public readonly failureReason?: string,
    public readonly timestamp?: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'bot_token.validated';
  }
}

export class BotTokenActivityLoggedEvent extends DomainEvent {
  constructor(
    public readonly tokenId: BotTokenId,
    public readonly botUserId: UserId,
    public readonly action: string,
    public readonly metadata?: Record<string, unknown>,
    public readonly timestamp?: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'bot_token.activity_logged';
  }
}

export class BotTokenSuspiciousActivityDetectedEvent extends DomainEvent {
  constructor(
    public readonly tokenId: BotTokenId,
    public readonly botUserId: UserId,
    public readonly activityType: string,
    public readonly details: Record<string, unknown>,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'bot_token.suspicious_activity_detected';
  }
}

export class BotTokenLimitExceededEvent extends DomainEvent {
  constructor(
    public readonly botUserId: UserId,
    public readonly companyId: CompanyId,
    public readonly currentCount: number,
    public readonly maxLimit: number,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'bot_token.limit_exceeded';
  }
}

export class BulkBotTokensRevokedEvent extends DomainEvent {
  constructor(
    public readonly botUserId: UserId,
    public readonly tokenIds: BotTokenId[],
    public readonly count: number,
    public readonly reason: string,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'bot_token.bulk_revoked';
  }
}

export class BotTokenCleanupPerformedEvent extends DomainEvent {
  constructor(
    public readonly expiredCount: number,
    public readonly revokedCount: number,
    public readonly totalCleaned: number,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'bot_token.cleanup_performed';
  }
}
