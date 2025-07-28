import { v4 as uuidv4 } from 'uuid';
import { InvalidValueObjectException } from '@core/exceptions/domain-exceptions';

export class SessionId {
  private readonly value: string;

  constructor(value: string) {
    if (!this.isValidUuid(value)) {
      throw new InvalidValueObjectException('Invalid session ID format');
    }
    this.value = value;
  }

  static create(): SessionId {
    return new SessionId(uuidv4());
  }

  static fromString(value: string): SessionId {
    return new SessionId(value);
  }

  getValue(): string {
    return this.value;
  }

  equals(other: SessionId): boolean {
    return this.value === other.value;
  }

  private isValidUuid(value: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    return uuidRegex.test(value);
  }

  toString(): string {
    return this.value;
  }
}
