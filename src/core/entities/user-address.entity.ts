import { AggregateRoot } from '@core/events/domain-event.base';
import { UserAddressId } from '@core/value-objects/user-address-id.vo';
import { UserId } from '@core/value-objects/user-id.vo';
import { CountryId } from '@core/value-objects/country-id.vo';
import { StateId } from '@core/value-objects/state-id.vo';
import {
  UserAddressCreatedEvent,
  UserAddressUpdatedEvent,
  UserAddressDeletedEvent,
} from '@core/events/user-address.events';

export interface IUserAddressProps {
  userId: UserId;
  countryId?: CountryId;
  stateId?: StateId;
  city?: string;
  street?: string;
  exteriorNumber?: string;
  interiorNumber?: string;
  postalCode?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class UserAddress extends AggregateRoot {
  private constructor(
    private readonly _id: UserAddressId,
    private readonly _props: IUserAddressProps,
  ) {
    super();
  }

  public static create(
    props: Omit<IUserAddressProps, 'createdAt' | 'updatedAt'>,
    id?: UserAddressId,
  ): UserAddress {
    const now = new Date();
    const addressId = id || UserAddressId.create();
    const address = new UserAddress(addressId, {
      ...props,
      createdAt: now,
      updatedAt: now,
    });

    address.addDomainEvent(
      new UserAddressCreatedEvent(
        addressId,
        props.userId,
        props.countryId || CountryId.fromString('default'),
        props.stateId || StateId.fromString('default'),
        'home',
        props.street || '',
        props.city || '',
        props.postalCode || '',
        false,
        now,
      ),
    );

    return address;
  }

  public static reconstruct(id: UserAddressId, props: IUserAddressProps): UserAddress {
    return new UserAddress(id, props);
  }

  // Getters
  public get id(): UserAddressId {
    return this._id;
  }

  public get userId(): UserId {
    return this._props.userId;
  }

  public get countryId(): CountryId | undefined {
    return this._props.countryId;
  }

  public get stateId(): StateId | undefined {
    return this._props.stateId;
  }

  public get city(): string | undefined {
    return this._props.city;
  }

  public get street(): string | undefined {
    return this._props.street;
  }

  public get exteriorNumber(): string | undefined {
    return this._props.exteriorNumber;
  }

  public get interiorNumber(): string | undefined {
    return this._props.interiorNumber;
  }

  public get postalCode(): string | undefined {
    return this._props.postalCode;
  }

  public get createdAt(): Date {
    return this._props.createdAt;
  }

  public get updatedAt(): Date {
    return this._props.updatedAt;
  }

  // Business methods
  public updateLocation(countryId?: CountryId, stateId?: StateId): void {
    let hasChanges = false;

    if (this._props.countryId !== countryId) {
      this._props.countryId = countryId;
      hasChanges = true;
    }

    if (this._props.stateId !== stateId) {
      this._props.stateId = stateId;
      hasChanges = true;
    }

    if (hasChanges) {
      this.touch();
    }
  }

  public updateAddressDetails(updates: {
    city?: string;
    street?: string;
    exteriorNumber?: string;
    interiorNumber?: string;
    postalCode?: string;
  }): void {
    let hasChanges = false;

    if (updates.city !== undefined && this._props.city !== updates.city) {
      this._props.city = updates.city;
      hasChanges = true;
    }

    if (updates.street !== undefined && this._props.street !== updates.street) {
      this._props.street = updates.street;
      hasChanges = true;
    }

    if (
      updates.exteriorNumber !== undefined &&
      this._props.exteriorNumber !== updates.exteriorNumber
    ) {
      this._props.exteriorNumber = updates.exteriorNumber;
      hasChanges = true;
    }

    if (
      updates.interiorNumber !== undefined &&
      this._props.interiorNumber !== updates.interiorNumber
    ) {
      this._props.interiorNumber = updates.interiorNumber;
      hasChanges = true;
    }

    if (updates.postalCode !== undefined && this._props.postalCode !== updates.postalCode) {
      if (updates.postalCode && !this.isValidPostalCode(updates.postalCode)) {
        throw new Error('Invalid postal code format');
      }
      this._props.postalCode = updates.postalCode;
      hasChanges = true;
    }

    if (hasChanges) {
      this.touch();
    }
  }

  public updateFullAddress(updates: {
    countryId?: CountryId;
    stateId?: StateId;
    city?: string;
    street?: string;
    exteriorNumber?: string;
    interiorNumber?: string;
    postalCode?: string;
  }): void {
    let hasChanges = false;

    // Update location
    if (updates.countryId !== undefined && this._props.countryId !== updates.countryId) {
      this._props.countryId = updates.countryId;
      hasChanges = true;
    }

    if (updates.stateId !== undefined && this._props.stateId !== updates.stateId) {
      this._props.stateId = updates.stateId;
      hasChanges = true;
    }

    // Update address details
    if (updates.city !== undefined && this._props.city !== updates.city) {
      this._props.city = updates.city;
      hasChanges = true;
    }

    if (updates.street !== undefined && this._props.street !== updates.street) {
      this._props.street = updates.street;
      hasChanges = true;
    }

    if (
      updates.exteriorNumber !== undefined &&
      this._props.exteriorNumber !== updates.exteriorNumber
    ) {
      this._props.exteriorNumber = updates.exteriorNumber;
      hasChanges = true;
    }

    if (
      updates.interiorNumber !== undefined &&
      this._props.interiorNumber !== updates.interiorNumber
    ) {
      this._props.interiorNumber = updates.interiorNumber;
      hasChanges = true;
    }

    if (updates.postalCode !== undefined && this._props.postalCode !== updates.postalCode) {
      if (updates.postalCode && !this.isValidPostalCode(updates.postalCode)) {
        throw new Error('Invalid postal code format');
      }
      this._props.postalCode = updates.postalCode;
      hasChanges = true;
    }

    if (hasChanges) {
      this.touch();

      this.addDomainEvent(
        new UserAddressUpdatedEvent(this._id, this._props.userId, updates, this._props.updatedAt),
      );
    }
  }

  public markForDeletion(): void {
    this.addDomainEvent(
      new UserAddressDeletedEvent(this._id, this._props.userId, 'home', new Date()),
    );
  }

  private touch(): void {
    this._props.updatedAt = new Date();
  }

  // Validation helpers
  private isValidPostalCode(postalCode: string): boolean {
    // Basic validation - can be extended for specific country formats
    return postalCode.trim().length >= 3 && postalCode.trim().length <= 10;
  }

  // Query methods
  public hasCompleteAddress(): boolean {
    return !!(
      this._props.countryId &&
      this._props.stateId &&
      this._props.city &&
      this._props.street &&
      this._props.exteriorNumber &&
      this._props.postalCode
    );
  }

  public getFormattedAddress(): string {
    const parts: string[] = [];

    if (this._props.street && this._props.exteriorNumber) {
      let streetLine = `${this._props.street} ${this._props.exteriorNumber}`;
      if (this._props.interiorNumber) {
        streetLine += ` Int. ${this._props.interiorNumber}`;
      }
      parts.push(streetLine);
    }

    if (this._props.city) {
      parts.push(this._props.city);
    }

    if (this._props.postalCode) {
      parts.push(`CP ${this._props.postalCode}`);
    }

    return parts.join(', ');
  }

  // Validation
  public isValid(): boolean {
    return !!this._props.userId;
  }
}
