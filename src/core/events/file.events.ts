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

export class FileUploadInitiatedEvent extends DomainEvent {
  constructor(
    public readonly fileId: string,
    public readonly userId: string | null,
    public readonly filename: string,
    public readonly uploadId: string,
  ) {
    super();
  }

  getEventName(): string {
    return 'file.upload.initiated';
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

/** Añadimos etag opcional (no rompe suscriptores actuales si lo ignoran) */
export class FileUploadCompletedEvent extends DomainEvent {
  constructor(
    public readonly fileId: string,
    public readonly userId: string | null,
    public readonly filename: string,
    public readonly size: number,
    public readonly etag?: string,
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

/* ---------- NUEVOS EVENTOS PARA OPERACIONES DE METADATOS ---------- */

/** Se emite cuando cambia path y/o filename (movimiento o rename). */
export class FileMovedEvent extends DomainEvent {
  constructor(
    public readonly fileId: string,
    public readonly userId: string | null,
    public readonly oldPath: string,
    public readonly oldFilename: string,
    public readonly newPath: string,
    public readonly newFilename: string,
    public readonly oldObjectKey: string,
    public readonly newObjectKey: string,
  ) {
    super();
  }

  getEventName(): string {
    return 'file.moved';
  }
}

/** Sugar específico de rename (por si quieres suscriptores dedicados). */
export class FileRenamedEvent extends DomainEvent {
  constructor(
    public readonly fileId: string,
    public readonly userId: string | null,
    public readonly path: string,
    public readonly oldFilename: string,
    public readonly newFilename: string,
    public readonly oldObjectKey: string,
    public readonly newObjectKey: string,
  ) {
    super();
  }

  getEventName(): string {
    return 'file.renamed';
  }
}

/** Se emite al cambiar `isPublic`. */
export class FileVisibilityChangedEvent extends DomainEvent {
  constructor(
    public readonly fileId: string,
    public readonly userId: string | null,
    public readonly isPublic: boolean,
  ) {
    super();
  }

  getEventName(): string {
    return 'file.visibility.changed';
  }
}
