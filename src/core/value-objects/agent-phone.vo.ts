import { InvalidValueObjectException } from '@core/exceptions/domain-exceptions';

export class AgentPhone {
  private readonly _value: string;

  constructor(value: string) {
    this.validate(value);
    this._value = value.trim();
  }

  private validate(value: string): void {
    if (!value || value.trim().length === 0) {
      throw new InvalidValueObjectException('Agent phone cannot be empty');
    }

    if (value.length < 10) {
      throw new InvalidValueObjectException('Agent phone must be at least 10 characters long');
    }

    if (value.length > 20) {
      throw new InvalidValueObjectException('Agent phone cannot exceed 20 characters');
    }

    // Allow numbers, spaces, hyphens, parentheses, and plus sign for international format
    const phoneRegex = /^[\d\s\-\(\)\+]+$/;
    if (!phoneRegex.test(value)) {
      throw new InvalidValueObjectException('Agent phone contains invalid characters');
    }
  }

  getValue(): string {
    return this._value;
  }

  equals(other: AgentPhone): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}
