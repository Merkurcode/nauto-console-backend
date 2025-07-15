import { InvalidValueObjectException } from '@core/exceptions/domain-exceptions';

export class Address {
  private readonly _country: string;
  private readonly _state: string;
  private readonly _city: string;
  private readonly _street: string;
  private readonly _exteriorNumber: string;
  private readonly _interiorNumber?: string;
  private readonly _postalCode: string;

  constructor(
    country: string,
    state: string,
    city: string,
    street: string,
    exteriorNumber: string,
    postalCode: string,
    interiorNumber?: string,
  ) {
    this.validate(country, state, city, street, exteriorNumber, postalCode);

    this._country = country.trim();
    this._state = state.trim();
    this._city = city.trim();
    this._street = street.trim();
    this._exteriorNumber = exteriorNumber.trim();
    this._interiorNumber = interiorNumber?.trim();
    this._postalCode = postalCode.trim();
  }

  private validate(
    country: string,
    state: string,
    city: string,
    street: string,
    exteriorNumber: string,
    postalCode: string,
  ): void {
    if (!country || country.trim().length === 0) {
      throw new InvalidValueObjectException('Country cannot be empty');
    }

    if (!state || state.trim().length === 0) {
      throw new InvalidValueObjectException('State cannot be empty');
    }

    if (!city || city.trim().length === 0) {
      throw new InvalidValueObjectException('City cannot be empty');
    }

    if (!street || street.trim().length === 0) {
      throw new InvalidValueObjectException('Street cannot be empty');
    }

    if (!exteriorNumber || exteriorNumber.trim().length === 0) {
      throw new InvalidValueObjectException('Exterior number cannot be empty');
    }

    if (!postalCode || postalCode.trim().length === 0) {
      throw new InvalidValueObjectException('Postal code cannot be empty');
    }

    if (country.length > 50) {
      throw new InvalidValueObjectException('Country name is too long');
    }

    if (state.length > 50) {
      throw new InvalidValueObjectException('State name is too long');
    }

    if (city.length > 50) {
      throw new InvalidValueObjectException('City name is too long');
    }

    if (street.length > 100) {
      throw new InvalidValueObjectException('Street name is too long');
    }

    if (exteriorNumber.length > 10) {
      throw new InvalidValueObjectException('Exterior number is too long');
    }

    if (postalCode.length > 10) {
      throw new InvalidValueObjectException('Postal code is too long');
    }
  }

  get country(): string {
    return this._country;
  }

  get state(): string {
    return this._state;
  }

  get city(): string {
    return this._city;
  }

  get street(): string {
    return this._street;
  }

  get exteriorNumber(): string {
    return this._exteriorNumber;
  }

  get interiorNumber(): string | undefined {
    return this._interiorNumber;
  }

  get postalCode(): string {
    return this._postalCode;
  }

  getFullAddress(): string {
    const interior = this._interiorNumber ? ` Int. ${this._interiorNumber}` : '';

    return `${this._street} ${this._exteriorNumber}${interior}, ${this._city}, ${this._state}, ${this._country} ${this._postalCode}`;
  }

  equals(other: Address): boolean {
    return (
      this._country === other._country &&
      this._state === other._state &&
      this._city === other._city &&
      this._street === other._street &&
      this._exteriorNumber === other._exteriorNumber &&
      this._interiorNumber === other._interiorNumber &&
      this._postalCode === other._postalCode
    );
  }
}
