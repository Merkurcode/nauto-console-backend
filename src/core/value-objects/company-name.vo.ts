import { InvalidValueObjectException } from '@core/exceptions/domain-exceptions';

export class CompanyName {
  private readonly _value: string;

  constructor(value: string) {
    this.validate(value);
    this._value = value.trim();
  }

  private validate(value: string): void {
    if (!value || value.trim().length === 0) {
      throw new InvalidValueObjectException('Company name cannot be empty');
    }

    if (value.length < 2) {
      throw new InvalidValueObjectException('Company name must be at least 2 characters long');
    }

    if (value.length > 100) {
      throw new InvalidValueObjectException('Company name is too long');
    }
  }

  getValue(): string {
    return this._value;
  }

  equals(other: CompanyName): boolean {
    return this._value === other._value;
  }
}
