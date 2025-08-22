import { v4 as uuidv4 } from 'uuid';
import { AggregateRoot } from '@core/events/domain-event.base';
import { FileStatus } from '@core/value-objects/file-status.vo';
import { ObjectKey } from '@core/value-objects/object-key.vo';
import { UploadId } from '@core/value-objects/upload-id.vo';
import { ETag } from '@core/value-objects/etag.vo';
import { FileSize } from '@core/value-objects/file-size.vo';
import {
  FilePendingEvent,
  FileUploadStartedEvent,
  FileUploadCompletedEvent,
  FileUploadFailedEvent,
  FileDeletedEvent,
  FileCanceledEvent,
  FileStatusChangedEvent,
  FileUploadInitiatedEvent,
  FileMovedEvent,
  FileRenamedEvent,
  FileVisibilityChangedEvent,
} from '@core/events/file.events';
import { InvalidFileStateException } from '@core/exceptions/storage-domain.exceptions';

export class File extends AggregateRoot {
  private readonly _id: string;
  private _filename: string;
  private _originalName: string;
  private _path: string;
  private _objectKey: ObjectKey;
  private _mimeType: string;
  private _size: FileSize;
  private _bucket: string;
  private _userId: string | null;
  private _isPublic: boolean;
  private _status: FileStatus;
  private _uploadId: UploadId | null;
  private _etag: ETag | null;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  private constructor(
    id: string,
    filename: string,
    originalName: string,
    path: string,
    objectKey: ObjectKey,
    mimeType: string,
    size: FileSize,
    bucket: string,
    userId: string | null,
    isPublic: boolean,
    status: FileStatus,
    uploadId: UploadId | null,
    etag: ETag | null,
    createdAt: Date,
    updatedAt: Date,
  ) {
    super();
    this._id = id;
    this._filename = filename;
    this._originalName = originalName;
    this._path = path;
    this._objectKey = objectKey;
    this._mimeType = mimeType;
    this._size = size;
    this._bucket = bucket;
    this._userId = userId;
    this._isPublic = isPublic;
    this._status = status;
    this._uploadId = uploadId;
    this._etag = etag;
    this._createdAt = createdAt;
    this._updatedAt = updatedAt;
  }

  // Getters
  get id(): string {
    return this._id;
  }
  get filename(): string {
    return this._filename;
  }
  get originalName(): string {
    return this._originalName;
  }
  get path(): string {
    return this._path;
  }
  get objectKey(): ObjectKey {
    return this._objectKey;
  }
  get mimeType(): string {
    return this._mimeType;
  }
  get size(): FileSize {
    return this._size;
  }
  get bucket(): string {
    return this._bucket;
  }
  get userId(): string | null {
    return this._userId;
  }
  get isPublic(): boolean {
    return this._isPublic;
  }
  get status(): FileStatus {
    return this._status;
  }
  get uploadId(): UploadId | null {
    return this._uploadId;
  }
  get etag(): ETag | null {
    return this._etag;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
  get updatedAt(): Date {
    return this._updatedAt;
  }

  // Factory method for creating new files (for multipart upload)
  public static createForUpload(
    filename: string,
    originalName: string,
    path: string,
    mimeType: string,
    size: number,
    bucket: string,
    userId: string | null = null,
  ): File {
    const objectKey = ObjectKey.join(path, filename);
    const fileSize = FileSize.fromBytes(size);
    const file = new File(
      uuidv4(),
      filename,
      originalName,
      path,
      objectKey,
      mimeType,
      fileSize,
      bucket,
      userId,
      false, // Start as private
      FileStatus.pending(),
      null, // No upload ID yet
      null, // No ETag yet
      new Date(),
      new Date(),
    );

    file.addDomainEvent(
      new FilePendingEvent(file._id, file._userId, file._filename, file._size.getBytes()),
    );

    return file;
  }

  // Factory method for reconstituting from persistence
  public static fromPersistence(data: {
    id: string;
    filename: string;
    originalName: string;
    path: string;
    objectKey: string;
    mimeType: string;
    size: number;
    bucket: string;
    userId: string | null;
    isPublic: boolean;
    status: string;
    uploadId?: string | null;
    etag?: string | null;
    createdAt: Date | string;
    updatedAt: Date | string;
  }): File {
    return new File(
      data.id,
      data.filename,
      data.originalName,
      data.path,
      ObjectKey.create(data.objectKey),
      data.mimeType,
      FileSize.fromBytes(data.size),
      data.bucket,
      data.userId,
      data.isPublic,
      FileStatus.fromString(data.status),
      data.uploadId ? UploadId.create(data.uploadId) : null,
      data.etag ? ETag.create(data.etag) : null,
      new Date(data.createdAt),
      new Date(data.updatedAt),
    );
  }

  // Business methods
  public makePublic(): void {
    if (!this._isPublic) {
      this._isPublic = true;
      this._updatedAt = new Date();
      this.addDomainEvent(new FileVisibilityChangedEvent(this._id, this._userId, true));
    }
  }
  public makePrivate(): void {
    if (this._isPublic) {
      this._isPublic = false;
      this._updatedAt = new Date();
      this.addDomainEvent(new FileVisibilityChangedEvent(this._id, this._userId, false));
    }
  }

  public updateUser(userId: string | null): void {
    if (this._status.isDeleted()) return;
    this._userId = userId;
    this._updatedAt = new Date();
  }

  /** Solo cambia el nombre “original” (no el key real). */
  public rename(newOriginalName: string): void {
    if (this._status.isDeleted()) return;
    this._originalName = newOriginalName;
    this._updatedAt = new Date();
  }

  public move(newPath: string, newFilename?: string): void {
    const oldPath = this._path;
    const oldFilename = this._filename;
    const oldObjectKey = this._objectKey.toString();

    this._path = newPath;
    if (newFilename) this._filename = newFilename;
    this._objectKey = ObjectKey.join(newPath, this._filename);
    this._updatedAt = new Date();

    const newObjectKey = this._objectKey.toString();

    // Evento general de movimiento
    this.addDomainEvent(
      new FileMovedEvent(
        this._id,
        this._userId,
        oldPath,
        oldFilename,
        this._path,
        this._filename,
        oldObjectKey,
        newObjectKey,
      ),
    );

    // Si solo cambió el nombre, emite también el específico de rename
    if (oldPath === this._path && oldFilename !== this._filename) {
      this.addDomainEvent(
        new FileRenamedEvent(
          this._id,
          this._userId,
          this._path,
          oldFilename,
          this._filename,
          oldObjectKey,
          newObjectKey,
        ),
      );
    }
  }

  // Multipart upload methods
  public initiateUpload(uploadId: string): void {
    if (this._status.isDeleted()) {
      throw new InvalidFileStateException(
        this._id,
        this._status.getValue(),
        'not-deleted',
        'initiate upload',
      );
    }
    if (!this._status.isPending()) {
      throw new InvalidFileStateException(
        this._id,
        this._status.getValue(),
        'pending',
        'initiate upload',
      );
    }

    const oldStatus = this._status;
    this._status = FileStatus.uploading();
    this._uploadId = UploadId.create(uploadId);
    this._etag = null; // limpiar etag al iniciar nueva subida
    this._updatedAt = new Date();

    this.addDomainEvent(
      new FileUploadInitiatedEvent(this._id, this._userId, this._filename, uploadId),
    );
    this.addDomainEvent(
      new FileUploadStartedEvent(this._id, this._userId, this._filename, this._size.getBytes()),
    );
    this.addDomainEvent(
      new FileStatusChangedEvent(this._id, this._userId, oldStatus, this._status),
    );
  }

  public completeUpload(etag?: string): void {
    if (!this._status.isUploading()) {
      /* ... igual que antes ... */
    }

    const oldStatus = this._status;
    this._status = FileStatus.uploaded();
    this._uploadId = null;
    if (etag) this._etag = ETag.create(etag);
    this._updatedAt = new Date();

    this.addDomainEvent(
      new FileUploadCompletedEvent(
        this._id,
        this._userId,
        this._filename,
        this._size.getBytes(),
        this._etag?.toString(), // pasa etag si quedó seteado
      ),
    );
    this.addDomainEvent(
      new FileStatusChangedEvent(this._id, this._userId, oldStatus, this._status),
    );
  }

  public markAsUploaded(): void {
    this.completeUpload();
  }

  public failUpload(reason: string = 'Upload failed'): void {
    if (this._status.isDeleted()) {
      throw new InvalidFileStateException(
        this._id,
        this._status.getValue(),
        'not-deleted',
        'fail upload',
      );
    }
    if (!this._status.isUploading() && !this._status.isPending()) {
      // solo tiene sentido fallar si estaba en pending/uploading
      throw new InvalidFileStateException(
        this._id,
        this._status.getValue(),
        'pending|uploading',
        'fail upload',
      );
    }

    const oldStatus = this._status;
    this._status = FileStatus.failed();
    this._uploadId = null;
    this._etag = null; // subir fallida → limpiar etag
    this._updatedAt = new Date();

    this.addDomainEvent(new FileUploadFailedEvent(this._id, this._userId, this._filename, reason));
    this.addDomainEvent(
      new FileStatusChangedEvent(this._id, this._userId, oldStatus, this._status),
    );
  }

  public markAsFailed(): void {
    this.failUpload();
  }

  public updateLastActivity(): void {
    this._updatedAt = new Date();
  }

  public markAsDeleted(): void {
    if (this._status.isUploading()) {
      // reforzamos la misma regla que aplicas en el servicio
      throw new InvalidFileStateException(
        this._id,
        this._status.getValue(),
        'not-uploading',
        'delete',
      );
    }
    if (!this._status.isDeleted()) {
      const oldStatus = this._status;
      this._status = FileStatus.deleted();
      this._uploadId = null;
      this._updatedAt = new Date();

      this.addDomainEvent(new FileDeletedEvent(this._id, this._userId, this._filename));
      this.addDomainEvent(
        new FileStatusChangedEvent(this._id, this._userId, oldStatus, this._status),
      );
    }
  }

  public markAsUploading(): void {
    if (this._status.isDeleted()) {
      throw new InvalidFileStateException(
        this._id,
        this._status.getValue(),
        'not-deleted',
        'mark uploading',
      );
    }
    if (!this._status.isUploading()) {
      const oldStatus = this._status;
      this._status = FileStatus.uploading();
      this._updatedAt = new Date();

      this.addDomainEvent(
        new FileUploadStartedEvent(this._id, this._userId, this._filename, this._size.getBytes()),
      );
      this.addDomainEvent(
        new FileStatusChangedEvent(this._id, this._userId, oldStatus, this._status),
      );
    }
  }

  public markAsPending(): void {
    if (this._status.isDeleted()) {
      throw new InvalidFileStateException(
        this._id,
        this._status.getValue(),
        'not-deleted',
        'mark pending',
      );
    }
    if (!this._status.isPending()) {
      const oldStatus = this._status;
      this._status = FileStatus.pending();
      this._uploadId = null;
      this._etag = null; // al volver a pending, limpiar etag previo
      this._updatedAt = new Date();

      this.addDomainEvent(
        new FilePendingEvent(this._id, this._userId, this._filename, this._size.getBytes()),
      );
      this.addDomainEvent(
        new FileStatusChangedEvent(this._id, this._userId, oldStatus, this._status),
      );
    }
  }

  public markAsCanceled(reason: string = 'Upload canceled'): void {
    if (this._status.isDeleted()) {
      throw new InvalidFileStateException(
        this._id,
        this._status.getValue(),
        'not-deleted',
        'cancel upload',
      );
    }
    if (!this._status.isCanceled()) {
      const oldStatus = this._status;
      this._status = FileStatus.canceled();
      this._uploadId = null;
      this._etag = null; // cancelar → limpiar etag
      this._updatedAt = new Date();

      this.addDomainEvent(new FileCanceledEvent(this._id, this._userId, this._filename, reason));
      this.addDomainEvent(
        new FileStatusChangedEvent(this._id, this._userId, oldStatus, this._status),
      );
    }
  }

  // Query methods
  public isUploading(): boolean {
    return this._status.isUploading() && this._uploadId !== null;
  }

  public isCompleted(): boolean {
    return this._status.isUploaded();
  }

  public canBeDeleted(): boolean {
    return !this._status.isUploading();
  }

  public canBeMoved(): boolean {
    return this._status.isUploaded() || this._status.isPending();
  }

  public canBeRenamed(): boolean {
    return this._status.isUploaded() || this._status.isPending();
  }

  // Utility methods
  public getFormattedSize(): string {
    return this._size.format();
  }

  public getSizeInBytes(): number {
    return this._size.getBytes();
  }

  public getObjectKeyString(): string {
    return this._objectKey.toString();
  }

  public getUploadIdString(): string | null {
    return this._uploadId?.toString() || null;
  }

  public getETagString(): string | null {
    return this._etag?.toString() || null;
  }
}
