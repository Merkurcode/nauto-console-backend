import { DomainEvent } from './domain-event.base';
import { StorageBytes } from '@core/value-objects/storage-bytes.vo';

export class StorageTierCreatedEvent extends DomainEvent {
  constructor(
    public readonly name: string,
    public readonly level: string,
    public readonly maxStorageBytes: StorageBytes,
  ) {
    super();
  }

  getEventName(): string {
    return 'storage_tier.created';
  }
}

export class StorageTierUpdatedEvent extends DomainEvent {
  constructor(
    public readonly tierId: string,
    public readonly field: string,
    public readonly oldValue: string,
    public readonly newValue: string,
  ) {
    super();
  }

  getEventName(): string {
    return 'storage_tier.updated';
  }
}

export class StorageTierActivatedEvent extends DomainEvent {
  constructor(
    public readonly tierId: string,
    public readonly name: string,
  ) {
    super();
  }

  getEventName(): string {
    return 'storage_tier.activated';
  }
}

export class StorageTierDeactivatedEvent extends DomainEvent {
  constructor(
    public readonly tierId: string,
    public readonly name: string,
  ) {
    super();
  }

  getEventName(): string {
    return 'storage_tier.deactivated';
  }
}
