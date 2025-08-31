import { v4 as uuidv4 } from 'uuid';
import { UserId } from '@core/value-objects/user-id.vo';
import { AggregateRoot } from '@core/events/domain-event.base';

export class Otp extends AggregateRoot {
  id: string;
  userId: UserId;
  secret: string;
  expiresAt: Date;
  verifiedAt?: Date;
  createdAt: Date;

  constructor(userId: UserId, secret: string, expirationMinutes: number, id?: string) {
    super();
    this.id = id || uuidv4();
    this.userId = userId;
    this.secret = secret;

    // Set expiration time
    const now = new Date();
    this.expiresAt = new Date(now.getTime() + expirationMinutes * 60000);
    this.createdAt = now;
  }

  isExpired(): boolean {
    return new Date() > this.expiresAt;
  }

  markAsVerified(): void {
    this.verifiedAt = new Date();
  }
}
