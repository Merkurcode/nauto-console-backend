import { DomainEvent } from './domain-event.base';
import { UserId } from '@core/value-objects/user-id.vo';
import { StorageBytes } from '@core/value-objects/storage-bytes.vo';

export class UserStorageConfigCreatedEvent extends DomainEvent {
  constructor(
    public readonly userId: UserId,
    public readonly storageTierId: string,
  ) {
    super();
  }

  getEventName(): string {
    return 'user.storage_config.created';
  }
}

export class UserStorageConfigUpdatedEvent extends DomainEvent {
  constructor(
    public readonly userId: UserId,
    public readonly field: string,
    public readonly oldValue: string,
    public readonly newValue: string,
  ) {
    super();
  }

  getEventName(): string {
    return 'user.storage_config.updated';
  }
}

export class UserStorageQuotaExceededEvent extends DomainEvent {
  constructor(
    public readonly userId: UserId,
    public readonly currentUsage: StorageBytes,
    public readonly maxStorage: StorageBytes,
    public readonly attemptedFileSize: number,
  ) {
    super();
  }

  getEventName(): string {
    return 'user.storage_quota.exceeded';
  }
}
