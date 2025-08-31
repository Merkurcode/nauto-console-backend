import { DomainEvent } from './domain-event.base';
import { CountryId } from '@core/value-objects/country-id.vo';

/**
 * Country Domain Events
 * Following DDD: Events represent significant business moments in the Country lifecycle
 */

export class CountryCreatedEvent extends DomainEvent {
  constructor(
    public readonly countryId: CountryId,
    public readonly name: string,
    public readonly code: string,
    public readonly isActive: boolean,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'country.created';
  }
}

export class CountryUpdatedEvent extends DomainEvent {
  constructor(
    public readonly countryId: CountryId,
    public readonly name: string,
    public readonly code: string,
    public readonly changes: {
      name?: string;
      isActive?: boolean;
    },
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'country.updated';
  }
}

export class CountryActivatedEvent extends DomainEvent {
  constructor(
    public readonly countryId: CountryId,
    public readonly name: string,
    public readonly code: string,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'country.activated';
  }
}

export class CountryDeactivatedEvent extends DomainEvent {
  constructor(
    public readonly countryId: CountryId,
    public readonly name: string,
    public readonly code: string,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'country.deactivated';
  }
}

export class CountryDeletedEvent extends DomainEvent {
  constructor(
    public readonly countryId: CountryId,
    public readonly name: string,
    public readonly code: string,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'country.deleted';
  }
}

export class BulkCountriesCreatedEvent extends DomainEvent {
  constructor(
    public readonly countryIds: CountryId[],
    public readonly count: number,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'country.bulk_created';
  }
}

export class CountryStatesUpdatedEvent extends DomainEvent {
  constructor(
    public readonly countryId: CountryId,
    public readonly name: string,
    public readonly code: string,
    public readonly stateCount: number,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'country.states_updated';
  }
}
