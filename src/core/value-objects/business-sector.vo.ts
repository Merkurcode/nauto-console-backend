import { InvalidValueObjectException } from '@core/exceptions/domain-exceptions';

export class BusinessSector {
  private readonly _value: string;

  constructor(value: string) {
    this.validate(value);
    this._value = value.trim();
  }

  private validate(value: string): void {
    if (!value || value.trim().length === 0) {
      throw new InvalidValueObjectException('Business sector cannot be empty');
    }

    if (value.length > 100) {
      throw new InvalidValueObjectException('Business sector name is too long');
    }
  }

  getValue(): string {
    return this._value;
  }

  equals(other: BusinessSector): boolean {
    return this._value === other._value;
  }
}
