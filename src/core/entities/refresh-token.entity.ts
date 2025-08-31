import { v4 as uuidv4 } from 'uuid';
import { UserId } from '@core/value-objects/user-id.vo';
import { Token } from '@core/value-objects/token.vo';
import { AggregateRoot } from '@core/events/domain-event.base';

export class RefreshToken extends AggregateRoot {
  id: string;
  userId: UserId;
  token: Token;
  expiresAt: Date;
  revokedAt?: Date;
  createdAt: Date;

  constructor(userId: UserId, token: Token, expirationDays: number, id?: string) {
    super();
    this.id = id || uuidv4();
    this.userId = userId;
    this.token = token;

    // Set expiration time
    const now = new Date();
    this.expiresAt = new Date(now.getTime() + expirationDays * 24 * 60 * 60 * 1000);
    this.createdAt = now;
  }

  isExpired(): boolean {
    return new Date() > this.expiresAt;
  }

  isRevoked(): boolean {
    return !!this.revokedAt;
  }

  revoke(): void {
    this.revokedAt = new Date();
  }
}
