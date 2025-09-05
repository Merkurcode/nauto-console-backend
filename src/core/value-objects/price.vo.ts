import { InvalidValueObjectException } from '@core/exceptions/domain-exceptions';

export class Price {
  private readonly value: number;

  constructor(value: number) {
    if (value < 0) {
      throw new InvalidValueObjectException('Price cannot be negative');
    }

    if (value > 9999999999.99) {
      throw new InvalidValueObjectException('Price exceeds maximum allowed value');
    }

    // Round to 2 decimal places
    this.value = Math.round(value * 100) / 100;
  }

  static create(value: number): Price {
    return new Price(value);
  }

  static fromString(value: string): Price {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
      throw new InvalidValueObjectException('Invalid price format');
    }

    return new Price(numValue);
  }

  getValue(): number {
    return this.value;
  }

  getFormattedValue(currency: string = 'USD', locale: string = 'en-US'): string {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
    }).format(this.value);
  }

  equals(other: Price): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value.toFixed(2);
  }
}
