export abstract class ValueObject<T> {
  protected readonly value: T;

  constructor(value: T) {
    this.value = value;
  }

  protected abstract validate(): void;

  public equals(other: ValueObject<T>): boolean {
    if (!other || other.constructor.name !== this.constructor.name) {
      return false;
    }

    return this.value === other.value;
  }

  public getValue(): T {
    return this.value;
  }
}
