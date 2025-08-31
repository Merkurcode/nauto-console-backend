import { BotTokenId } from '@core/value-objects/bot-token-id.vo';
import { UserId } from '@core/value-objects/user-id.vo';
import { CompanyId } from '@core/value-objects/company-id.vo';
import { EntityNotFoundException } from '@core/exceptions/domain-exceptions';
import { AggregateRoot } from '@core/events/domain-event.base';

/**
 * BOT Token Entity
 * Represents a BOT token with its metadata and lifecycle
 */
export class BotToken extends AggregateRoot {
  private _id: BotTokenId;
  private _tokenId: string;
  private _sessionTokenId: string; // jti for session validation
  private _botUserId: UserId;
  private _botEmail: string;
  private _companyId?: CompanyId;
  private _issuedBy: UserId;
  private _issuedAt: Date;
  private _revokedAt?: Date;
  private _revokedBy?: UserId;
  private _isActive: boolean;

  constructor(
    id: BotTokenId,
    tokenId: string,
    sessionTokenId: string,
    botUserId: UserId,
    botEmail: string,
    issuedBy: UserId,
    issuedAt: Date,
    companyId?: CompanyId,
    revokedAt?: Date,
    revokedBy?: UserId,
    isActive: boolean = true,
  ) {
    super();
    this._id = id;
    this._tokenId = tokenId;
    this._sessionTokenId = sessionTokenId;
    this._botUserId = botUserId;
    this._botEmail = botEmail;
    this._issuedBy = issuedBy;
    this._issuedAt = issuedAt;
    this._companyId = companyId;
    this._revokedAt = revokedAt;
    this._revokedBy = revokedBy;
    this._isActive = isActive;
  }

  /**
   * Create a new BOT token
   */
  static create(
    tokenId: string,
    sessionTokenId: string,
    botUserId: UserId,
    botEmail: string,
    issuedBy: UserId,
    companyId?: CompanyId,
  ): BotToken {
    return new BotToken(
      BotTokenId.generate(),
      tokenId,
      sessionTokenId,
      botUserId,
      botEmail,
      issuedBy,
      new Date(),
      companyId,
      undefined,
      undefined,
      true,
    );
  }

  /**
   * Revoke the token
   */
  revoke(revokedBy: UserId): void {
    if (!this._isActive) {
      throw new EntityNotFoundException('BotToken', 'Token already revoked');
    }

    this._isActive = false;
    this._revokedAt = new Date();
    this._revokedBy = revokedBy;
  }

  /**
   * Check if token is valid (not revoked and active)
   */
  isValid(): boolean {
    return this._isActive && !this._revokedAt;
  }

  // Getters
  get id(): BotTokenId {
    return this._id;
  }

  get tokenId(): string {
    return this._tokenId;
  }

  get sessionTokenId(): string {
    return this._sessionTokenId;
  }

  get botUserId(): UserId {
    return this._botUserId;
  }

  get botEmail(): string {
    return this._botEmail;
  }

  get companyId(): CompanyId | undefined {
    return this._companyId;
  }

  get issuedBy(): UserId {
    return this._issuedBy;
  }

  get issuedAt(): Date {
    return this._issuedAt;
  }

  get revokedAt(): Date | undefined {
    return this._revokedAt;
  }

  get revokedBy(): UserId | undefined {
    return this._revokedBy;
  }

  get isActive(): boolean {
    return this._isActive;
  }
}
