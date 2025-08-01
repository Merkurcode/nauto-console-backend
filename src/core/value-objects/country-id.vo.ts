import { v4 as uuidv4 } from 'uuid';
import { InvalidValueObjectException } from '@core/exceptions/domain-exceptions';

export class CountryId {
  private readonly _value: string;

  private constructor(value: string) {
    this.validateId(value);
    this._value = value;
  }

  static create(): CountryId {
    return new CountryId(uuidv4());
  }

  static fromString(value: string): CountryId {
    return new CountryId(value);
  }

  getValue(): string {
    return this._value;
  }

  equals(other: CountryId): boolean {
    return this._value === other._value;
  }

  toString(): string {
    return this._value;
  }

  private validateId(value: string): void {
    if (!value) {
      throw new InvalidValueObjectException('Country ID cannot be empty');
    }

    // Basic UUID format validation
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(value)) {
      throw new InvalidValueObjectException('Country ID must be a valid UUID');
    }
  }
}
