import { v4 as uuidv4 } from 'uuid';
import { AggregateRoot } from '@core/events/domain-event.base';
import { FileStatus } from '@core/value-objects/file-status.vo';
import {
  FilePendingEvent,
  FileUploadStartedEvent,
  FileUploadCompletedEvent,
  FileUploadFailedEvent,
  FileDeletedEvent,
  FileCanceledEvent,
  FileStatusChangedEvent,
} from '@core/events/file.events';

export class File extends AggregateRoot {
  id: string;
  filename: string;
  originalName: string;
  path: string;
  mimeType: string;
  size: number;
  bucket: string;
  userId: string | null;
  isPublic: boolean;
  status: FileStatus;
  createdAt: Date;
  updatedAt: Date;

  constructor(
    filename: string,
    originalName: string,
    path: string,
    mimeType: string,
    size: number,
    bucket: string,
    userId: string | null = null,
    isPublic: boolean = false,
    status: FileStatus = FileStatus.pending(),
    id?: string,
  ) {
    super();
    this.id = id || uuidv4();
    this.filename = filename;
    this.originalName = originalName;
    this.path = path;
    this.mimeType = mimeType;
    this.size = size;
    this.bucket = bucket;
    this.userId = userId;
    this.isPublic = isPublic;
    this.status = status;
    this.createdAt = new Date();
    this.updatedAt = new Date();
  }

  makePublic(): void {
    if (!this.isPublic) {
      this.isPublic = true;
      this.updatedAt = new Date();
    }
  }

  makePrivate(): void {
    if (this.isPublic) {
      this.isPublic = false;
      this.updatedAt = new Date();
    }
  }

  updateUser(userId: string | null): void {
    this.userId = userId;
    this.updatedAt = new Date();
  }

  rename(newOriginalName: string): void {
    this.originalName = newOriginalName;
    this.updatedAt = new Date();
  }

  move(newPath: string, newBucket?: string): void {
    this.path = newPath;
    if (newBucket) {
      this.bucket = newBucket;
    }
    this.updatedAt = new Date();
  }

  markAsUploaded(): void {
    if (!this.status.isUploaded()) {
      const oldStatus = this.status;
      this.status = FileStatus.uploaded();
      this.updatedAt = new Date();

      this.addDomainEvent(
        new FileUploadCompletedEvent(this.id, this.userId, this.filename, this.size),
      );
      this.addDomainEvent(new FileStatusChangedEvent(this.id, this.userId, oldStatus, this.status));
    }
  }

  markAsFailed(): void {
    if (!this.status.isFailed()) {
      const oldStatus = this.status;
      this.status = FileStatus.failed();
      this.updatedAt = new Date();

      this.addDomainEvent(
        new FileUploadFailedEvent(this.id, this.userId, this.filename, 'Upload failed'),
      );
      this.addDomainEvent(new FileStatusChangedEvent(this.id, this.userId, oldStatus, this.status));
    }
  }

  markAsDeleted(): void {
    if (!this.status.isDeleted()) {
      const oldStatus = this.status;
      this.status = FileStatus.deleted();
      this.updatedAt = new Date();

      this.addDomainEvent(new FileDeletedEvent(this.id, this.userId, this.filename));
      this.addDomainEvent(new FileStatusChangedEvent(this.id, this.userId, oldStatus, this.status));
    }
  }

  markAsUploading(): void {
    if (!this.status.isUploading()) {
      const oldStatus = this.status;
      this.status = FileStatus.uploading();
      this.updatedAt = new Date();

      this.addDomainEvent(
        new FileUploadStartedEvent(this.id, this.userId, this.filename, this.size),
      );
      this.addDomainEvent(new FileStatusChangedEvent(this.id, this.userId, oldStatus, this.status));
    }
  }

  markAsPending(): void {
    if (!this.status.isPending()) {
      const oldStatus = this.status;
      this.status = FileStatus.pending();
      this.updatedAt = new Date();

      this.addDomainEvent(new FilePendingEvent(this.id, this.userId, this.filename, this.size));
      this.addDomainEvent(new FileStatusChangedEvent(this.id, this.userId, oldStatus, this.status));
    }
  }

  markAsCanceled(reason: string = 'Upload canceled'): void {
    if (!this.status.isCanceled()) {
      const oldStatus = this.status;
      this.status = FileStatus.canceled();
      this.updatedAt = new Date();

      this.addDomainEvent(new FileCanceledEvent(this.id, this.userId, this.filename, reason));
      this.addDomainEvent(new FileStatusChangedEvent(this.id, this.userId, oldStatus, this.status));
    }
  }

  static fromData(data: {
    id: string;
    filename: string;
    originalName: string;
    path: string;
    mimeType: string;
    size: number;
    bucket: string;
    userId: string | null;
    isPublic: boolean;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  }): File {
    const file = new File(
      data.filename,
      data.originalName,
      data.path,
      data.mimeType,
      data.size,
      data.bucket,
      data.userId,
      data.isPublic,
      FileStatus.fromString(data.status),
      data.id,
    );
    file.createdAt = new Date(data.createdAt);
    file.updatedAt = new Date(data.updatedAt);

    return file;
  }
}
