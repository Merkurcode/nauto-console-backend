import { InvalidValueObjectException } from '@core/exceptions/domain-exceptions';

export class ProductCatalogId {
  private readonly value: string;

  constructor(value: string) {
    if (!value || value.trim().length === 0) {
      throw new InvalidValueObjectException('Product catalog ID cannot be empty');
    }

    if (value.length > 100) {
      throw new InvalidValueObjectException('Product catalog ID cannot exceed 100 characters');
    }

    this.value = value.trim();
  }

  static create(value: string): ProductCatalogId {
    return new ProductCatalogId(value);
  }

  getValue(): string {
    return this.value;
  }

  equals(other: ProductCatalogId): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
