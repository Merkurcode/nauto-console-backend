import { InvalidValueObjectException } from '@core/exceptions/domain-exceptions';

export class ProductMediaId {
  private readonly value: string;

  constructor(value: string) {
    if (!value || value.trim().length === 0) {
      throw new InvalidValueObjectException('Product media ID cannot be empty');
    }

    if (value.length > 100) {
      throw new InvalidValueObjectException('Product media ID cannot exceed 100 characters');
    }

    this.value = value.trim();
  }

  static create(value: string): ProductMediaId {
    return new ProductMediaId(value);
  }

  getValue(): string {
    return this.value;
  }

  equals(other: ProductMediaId): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
