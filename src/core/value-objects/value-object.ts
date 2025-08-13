export abstract class ValueObject<T> {
  protected readonly _value: T;

  constructor(value: T) {
    this.validate(value);
    this._value = value;
  }

  protected abstract validate(value: T): void;

  public getValue(): T {
    return this._value;
  }

  public equals(other: ValueObject<T>): boolean {
    if (!other || !(other instanceof ValueObject)) {
      return false;
    }

    return this._value === other._value;
  }

  public toString(): string {
    return String(this._value);
  }
}
