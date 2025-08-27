import { InvalidValueObjectException } from '@core/exceptions/domain-exceptions';

export class AgentPhone {
  private readonly _value: string;
  private readonly _countryCode: string;

  constructor(value: string, countryCode?: string) {
    this.validate(value, countryCode);
    this._value = value.trim();
    this._countryCode = countryCode?.trim();
  }

  private validate(value: string, countryCode?: string): void {
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

    if (countryCode && countryCode.trim().length === 0) {
      throw new InvalidValueObjectException('Country code cannot be empty when provided');
    }

    if (countryCode && (countryCode.length < 1 || countryCode.length > 5)) {
      throw new InvalidValueObjectException('Country code must be between 1 and 5 characters');
    }
  }

  getValue(): string {
    return this._value;
  }

  getCountryCode(): string {
    return this._countryCode;
  }

  equals(other: AgentPhone): boolean {
    return this._value === other._value && this._countryCode === other._countryCode;
  }

  toString(): string {
    return this._value;
  }
}
