import { AggregateRoot } from '@core/events/domain-event.base';
import { CountryId } from '@core/value-objects/country-id.vo';
import { InvalidValueObjectException } from '@core/exceptions/domain-exceptions';
import { CountryCreatedEvent } from '@core/events/country.events';

export class Country extends AggregateRoot {
  private readonly _id: CountryId;
  private _name: string;
  private _imageUrl?: string;
  private _phoneCode: string;
  private _langCode: string;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  private constructor(
    id: CountryId,
    name: string,
    phoneCode: string,
    langCode: string,
    createdAt?: Date,
    imageUrl?: string,
  ) {
    super();
    this._id = id;
    this._name = name;
    this._phoneCode = phoneCode;
    this._langCode = langCode;
    this._imageUrl = imageUrl;
    this._createdAt = createdAt || new Date();
    this._updatedAt = new Date();
  }

  static create(name: string, phoneCode: string, langCode: string, imageUrl?: string): Country {
    if (!name || !name.trim()) {
      throw new InvalidValueObjectException('Country name cannot be empty');
    }
    if (!phoneCode || !phoneCode.trim()) {
      throw new InvalidValueObjectException('Phone code cannot be empty');
    }
    if (!langCode || !langCode.trim()) {
      throw new InvalidValueObjectException('Language code cannot be empty');
    }

    const countryId = CountryId.create();
    const country = new Country(
      countryId,
      name.trim(),
      phoneCode.trim(),
      langCode.trim(),
      undefined,
      imageUrl?.trim(),
    );

    country.addDomainEvent(
      new CountryCreatedEvent(countryId, name.trim(), phoneCode.trim(), true, new Date()),
    );

    return country;
  }

  static fromPersistence(data: {
    id: string;
    name: string;
    phoneCode: string;
    langCode: string;
    imageUrl?: string;
    createdAt: Date;
    updatedAt: Date;
  }): Country {
    const country = new Country(
      CountryId.fromString(data.id),
      data.name,
      data.phoneCode,
      data.langCode,
      data.createdAt,
      data.imageUrl,
    );
    country._updatedAt = data.updatedAt;

    return country;
  }

  // Getters
  get id(): CountryId {
    return this._id;
  }

  get name(): string {
    return this._name;
  }

  get phoneCode(): string {
    return this._phoneCode;
  }

  get langCode(): string {
    return this._langCode;
  }

  get imageUrl(): string | undefined {
    return this._imageUrl;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  // Business methods
  updateName(name: string): void {
    if (!name || !name.trim()) {
      throw new InvalidValueObjectException('Country name cannot be empty');
    }
    this._name = name.trim();
    this._updatedAt = new Date();
  }

  updatePhoneCode(phoneCode: string): void {
    if (!phoneCode || !phoneCode.trim()) {
      throw new InvalidValueObjectException('Phone code cannot be empty');
    }
    this._phoneCode = phoneCode.trim();
    this._updatedAt = new Date();
  }

  updateLangCode(langCode: string): void {
    if (!langCode || !langCode.trim()) {
      throw new InvalidValueObjectException('Language code cannot be empty');
    }
    this._langCode = langCode.trim();
    this._updatedAt = new Date();
  }

  updateImageUrl(imageUrl?: string): void {
    this._imageUrl = imageUrl?.trim();
    this._updatedAt = new Date();
  }
}
