import { v4 as uuid } from 'uuid';
import { Email } from '@core/value-objects/email.vo';
import { Token } from '@core/value-objects/token.vo';
import { UserId } from '@core/value-objects/user-id.vo';
import { AggregateRoot } from '@core/events/domain-event.base';

export class PasswordReset extends AggregateRoot {
  id: string;
  userId: UserId;
  email: Email;
  token: Token;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;

  constructor(userId: UserId, email: Email, expirationMinutes: number = 60, id?: string) {
    super();
    this.id = id || uuid();
    this.userId = userId;
    this.email = email;
    this.token = Token.generate();

    // Set expiration time (default: 60 minutes)
    const now = new Date();
    this.expiresAt = new Date(now.getTime() + expirationMinutes * 60000);

    this.usedAt = null;
    this.createdAt = now;
  }

  isExpired(): boolean {
    return new Date() > this.expiresAt;
  }

  isUsed(): boolean {
    return this.usedAt !== null;
  }

  markAsUsed(): void {
    this.usedAt = new Date();
  }
}
