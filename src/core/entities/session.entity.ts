import { UserId } from '@core/value-objects/user-id.vo';
import { SessionId } from '@core/value-objects/session-id.vo';
import { AggregateRoot } from '@core/events/domain-event.base';
import { SessionCreatedEvent, SessionRevokedEvent } from '@core/events/session.events';

export class Session extends AggregateRoot {
  private readonly _id: SessionId;
  private readonly _userId: UserId;
  private readonly _sessionToken: string;
  private readonly _refreshToken: string;
  private readonly _userAgent: string | null;
  private readonly _ipAddress: string;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  private constructor(
    id: SessionId,
    userId: UserId,
    sessionToken: string,
    refreshToken: string,
    userAgent: string | null,
    ipAddress: string,
    createdAt?: Date,
  ) {
    super();
    this._id = id;
    this._userId = userId;
    this._sessionToken = sessionToken;
    this._refreshToken = refreshToken;
    this._userAgent = userAgent;
    this._ipAddress = ipAddress;
    this._createdAt = createdAt || new Date();
    this._updatedAt = new Date();
  }

  // Factory method for creating new sessions
  static create(
    userId: UserId,
    sessionToken: string,
    refreshToken: string,
    userAgent: string | null,
    ipAddress: string,
  ): Session {
    const session = new Session(
      SessionId.create(),
      userId,
      sessionToken,
      refreshToken,
      userAgent,
      ipAddress,
    );

    session.addDomainEvent(new SessionCreatedEvent(session._id, session._userId));
    return session;
  }

  // Factory method for reconstituting from persistence
  static fromData(data: {
    id: string;
    userId: string;
    sessionToken: string;
    refreshToken: string;
    userAgent: string | null;
    ipAddress: string;
    createdAt: Date;
    updatedAt: Date;
  }): Session {
    return new Session(
      SessionId.fromString(data.id),
      UserId.fromString(data.userId),
      data.sessionToken,
      data.refreshToken,
      data.userAgent,
      data.ipAddress,
      data.createdAt,
    );
  }

  // Getters
  get id(): SessionId {
    return this._id;
  }

  get userId(): UserId {
    return this._userId;
  }

  get sessionToken(): string {
    return this._sessionToken;
  }

  get refreshToken(): string {
    return this._refreshToken;
  }

  get userAgent(): string | null {
    return this._userAgent;
  }

  get ipAddress(): string {
    return this._ipAddress;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  // Business methods
  updateActivity(): void {
    this._updatedAt = new Date();
  }

  revoke(): void {
    this.addDomainEvent(new SessionRevokedEvent(this._id, this._userId));
  }

  // Helper methods for session validation
  isTokenMatch(sessionToken: string): boolean {
    return this._sessionToken === sessionToken;
  }

  isRefreshTokenMatch(refreshToken: string): boolean {
    return this._refreshToken === refreshToken;
  }

  // For persistence
  toPersistence() {
    return {
      id: this._id.getValue(),
      userId: this._userId.getValue(),
      sessionToken: this._sessionToken,
      refreshToken: this._refreshToken,
      userAgent: this._userAgent,
      ipAddress: this._ipAddress,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    };
  }
}