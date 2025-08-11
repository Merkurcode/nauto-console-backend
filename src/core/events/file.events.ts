import { DomainEvent } from './domain-event.base';
import { FileStatus } from '@core/value-objects/file-status.vo';

export class FilePendingEvent extends DomainEvent {
  constructor(
    public readonly fileId: string,
    public readonly userId: string | null,
    public readonly filename: string,
    public readonly size: number,
  ) {
    super();
  }

  getEventName(): string {
    return 'file.pending';
  }
}

export class FileUploadStartedEvent extends DomainEvent {
  constructor(
    public readonly fileId: string,
    public readonly userId: string | null,
    public readonly filename: string,
    public readonly size: number,
  ) {
    super();
  }

  getEventName(): string {
    return 'file.upload.started';
  }
}

export class FileUploadCompletedEvent extends DomainEvent {
  constructor(
    public readonly fileId: string,
    public readonly userId: string | null,
    public readonly filename: string,
    public readonly size: number,
  ) {
    super();
  }

  getEventName(): string {
    return 'file.upload.completed';
  }
}

export class FileUploadFailedEvent extends DomainEvent {
  constructor(
    public readonly fileId: string,
    public readonly userId: string | null,
    public readonly filename: string,
    public readonly error: string,
  ) {
    super();
  }

  getEventName(): string {
    return 'file.upload.failed';
  }
}

export class FileDeletedEvent extends DomainEvent {
  constructor(
    public readonly fileId: string,
    public readonly userId: string | null,
    public readonly filename: string,
  ) {
    super();
  }

  getEventName(): string {
    return 'file.deleted';
  }
}

export class FileCanceledEvent extends DomainEvent {
  constructor(
    public readonly fileId: string,
    public readonly userId: string | null,
    public readonly filename: string,
    public readonly reason: string,
  ) {
    super();
  }

  getEventName(): string {
    return 'file.canceled';
  }
}

export class FileStatusChangedEvent extends DomainEvent {
  constructor(
    public readonly fileId: string,
    public readonly userId: string | null,
    public readonly oldStatus: FileStatus,
    public readonly newStatus: FileStatus,
  ) {
    super();
  }

  getEventName(): string {
    return 'file.status.changed';
  }
}
