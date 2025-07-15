import { InvalidValueObjectException } from '@core/exceptions/domain-exceptions';

export class BusinessUnit {
  private readonly _value: string;

  constructor(value: string) {
    this.validate(value);
    this._value = value.trim();
  }

  private validate(value: string): void {
    if (!value || value.trim().length === 0) {
      throw new InvalidValueObjectException('Business unit cannot be empty');
    }

    if (value.length > 100) {
      throw new InvalidValueObjectException('Business unit name is too long');
    }
  }

  getValue(): string {
    return this._value;
  }

  equals(other: BusinessUnit): boolean {
    return this._value === other._value;
  }
}
