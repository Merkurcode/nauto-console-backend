import { DomainEvent } from './domain-event.base';
import { StateId } from '@core/value-objects/state-id.vo';
import { CountryId } from '@core/value-objects/country-id.vo';

/**
 * State Domain Events
 * Following DDD: Events represent significant business moments in the State lifecycle
 */

export class StateCreatedEvent extends DomainEvent {
  constructor(
    public readonly stateId: StateId,
    public readonly countryId: CountryId,
    public readonly name: string,
    public readonly code: string,
    public readonly isActive: boolean,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'state.created';
  }
}

export class StateUpdatedEvent extends DomainEvent {
  constructor(
    public readonly stateId: StateId,
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
    return 'state.updated';
  }
}

export class StateActivatedEvent extends DomainEvent {
  constructor(
    public readonly stateId: StateId,
    public readonly countryId: CountryId,
    public readonly name: string,
    public readonly code: string,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'state.activated';
  }
}

export class StateDeactivatedEvent extends DomainEvent {
  constructor(
    public readonly stateId: StateId,
    public readonly countryId: CountryId,
    public readonly name: string,
    public readonly code: string,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'state.deactivated';
  }
}

export class StateDeletedEvent extends DomainEvent {
  constructor(
    public readonly stateId: StateId,
    public readonly countryId: CountryId,
    public readonly name: string,
    public readonly code: string,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'state.deleted';
  }
}

export class BulkStatesCreatedEvent extends DomainEvent {
  constructor(
    public readonly countryId: CountryId,
    public readonly stateIds: StateId[],
    public readonly count: number,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'state.bulk_created';
  }
}
