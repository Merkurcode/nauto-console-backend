import { InvalidValueObjectException } from '@core/exceptions/domain-exceptions';

export class SecondLastName {
  private readonly _value: string;

  constructor(value: string) {
    this.validate(value);
    this._value = value.trim();
  }

  private validate(value: string): void {
    if (!value || value.trim().length === 0) {
      throw new InvalidValueObjectException('Second last name cannot be empty');
    }

    if (value.trim().length < 2) {
      throw new InvalidValueObjectException('Second last name must be at least 2 characters long');
    }

    if (value.length > 50) {
      throw new InvalidValueObjectException('Second last name cannot exceed 50 characters');
    }

    // Only allow letters, spaces, hyphens, and apostrophes
    const nameRegex = /^[a-zA-ZÀ-ÿ\u00f1\u00d1\s'-]+$/;
    if (!nameRegex.test(value)) {
      throw new InvalidValueObjectException('Second last name contains invalid characters');
    }
  }

  getValue(): string {
    return this._value;
  }

  equals(other: SecondLastName): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }
}
