import { DomainEvent } from './domain-event.base';
import { UserAddressId } from '@core/value-objects/user-address-id.vo';
import { UserId } from '@core/value-objects/user-id.vo';
import { CountryId } from '@core/value-objects/country-id.vo';
import { StateId } from '@core/value-objects/state-id.vo';

/**
 * User Address Domain Events
 * Following DDD: Events represent significant business moments in the User Address lifecycle
 */

export class UserAddressCreatedEvent extends DomainEvent {
  constructor(
    public readonly addressId: UserAddressId,
    public readonly userId: UserId,
    public readonly countryId: CountryId,
    public readonly stateId: StateId,
    public readonly addressType: string,
    public readonly street: string,
    public readonly city: string,
    public readonly zipCode: string,
    public readonly isDefault: boolean,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'user_address.created';
  }
}

export class UserAddressUpdatedEvent extends DomainEvent {
  constructor(
    public readonly addressId: UserAddressId,
    public readonly userId: UserId,
    public readonly changes: {
      countryId?: CountryId;
      stateId?: StateId;
      street?: string;
      city?: string;
      zipCode?: string;
      isDefault?: boolean;
    },
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'user_address.updated';
  }
}

export class UserAddressDeletedEvent extends DomainEvent {
  constructor(
    public readonly addressId: UserAddressId,
    public readonly userId: UserId,
    public readonly addressType: string,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'user_address.deleted';
  }
}

export class UserAddressSetAsDefaultEvent extends DomainEvent {
  constructor(
    public readonly addressId: UserAddressId,
    public readonly userId: UserId,
    public readonly addressType: string,
    public readonly previousDefaultId?: UserAddressId,
    public readonly timestamp?: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'user_address.set_as_default';
  }
}

export class UserAddressValidatedEvent extends DomainEvent {
  constructor(
    public readonly addressId: UserAddressId,
    public readonly userId: UserId,
    public readonly validationResult: boolean,
    public readonly validationDetails: Record<string, unknown>,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'user_address.validated';
  }
}

export class BulkUserAddressesCreatedEvent extends DomainEvent {
  constructor(
    public readonly userId: UserId,
    public readonly addressIds: UserAddressId[],
    public readonly count: number,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'user_address.bulk_created';
  }
}

export class UserAddressesCleanupPerformedEvent extends DomainEvent {
  constructor(
    public readonly userId: UserId,
    public readonly deletedCount: number,
    public readonly archivedCount: number,
    public readonly totalCleaned: number,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'user_address.cleanup_performed';
  }
}
