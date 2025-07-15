import { InvalidValueObjectException } from '@core/exceptions/domain-exceptions';

export class CompanyDescription {
  private readonly _value: string;

  constructor(value: string) {
    this.validate(value);
    this._value = value.trim();
  }

  private validate(value: string): void {
    if (!value || value.trim().length === 0) {
      throw new InvalidValueObjectException('Company description cannot be empty');
    }

    if (value.length < 10) {
      throw new InvalidValueObjectException(
        'Company description must be at least 10 characters long',
      );
    }

    if (value.length > 500) {
      throw new InvalidValueObjectException('Company description is too long');
    }
  }

  getValue(): string {
    return this._value;
  }

  equals(other: CompanyDescription): boolean {
    return this._value === other._value;
  }
}
