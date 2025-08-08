import { v4 as uuidv4 } from 'uuid';

/**
 * Value Object for BOT Token ID
 */
export class BotTokenId {
  private readonly _value: string;

  constructor(value: string) {
    if (!value || value.trim() === '') {
      throw new Error('BotTokenId cannot be empty');
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(value)) {
      throw new Error('BotTokenId must be a valid UUID');
    }

    this._value = value;
  }

  static generate(): BotTokenId {
    return new BotTokenId(uuidv4());
  }

  static fromString(value: string): BotTokenId {
    return new BotTokenId(value);
  }

  getValue(): string {
    return this._value;
  }

  equals(other: BotTokenId): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}
