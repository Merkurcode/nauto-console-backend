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
  FileStatusChangedEvent,
  FileUploadInitiatedEvent,
  FileMovedEvent,
  FileRenamedEvent,
  FileVisibilityChangedEvent,
  FileCopyInitiatedEvent,
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
  private _targetApps: string[];
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
    targetApps: string[],
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
    this._targetApps = targetApps;
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
  get targetApps(): string[] {
    return this._targetApps;
  }

  // Simple factory method - path and access already determined by endpoint
  public static createForUpload(
    filename: string,
    originalName: string,
    storagePath: string,
    objectKey: string,
    mimeType: string,
    size: number,
    bucket: string,
    userId: string,
    isPublic: boolean = false, // Determined by area (common = public, user = private)
    targetApps: string[] = [],
  ): File {
    const fileSize = FileSize.fromBytes(size);
    const objectKeyVo = ObjectKey.create(objectKey);

    const file = new File(
      uuidv4(),
      filename,
      originalName,
      storagePath,
      objectKeyVo,
      mimeType,
      fileSize,
      bucket,
      userId,
      isPublic,
      FileStatus.pending(),
      null, // No upload ID yet
      null, // No ETag yet
      targetApps,
      new Date(),
      new Date(),
    );

    file.addDomainEvent(
      new FilePendingEvent(file._id, file._userId, file._filename, file._size.getBytes()),
    );

    return file;
  }

  public static createForCopy(params: {
    filename: string;
    originalName: string;
    path: string;
    objectKey: ObjectKey;
    mimeType: string;
    size: FileSize;
    bucket: string;
    userId: string;
    isPublic: boolean;
    sourceFileId: string;
    targetApps?: string[];
  }): File {
    const file = new File(
      uuidv4(),
      params.filename,
      params.originalName,
      params.path,
      params.objectKey,
      params.mimeType,
      params.size,
      params.bucket,
      params.userId,
      params.isPublic,
      FileStatus.copying(), // Start in COPYING state
      null, // No upload ID for copies
      null, // No ETag yet
      params.targetApps || [],
      new Date(),
      new Date(),
    );

    // Emit domain event for copy initiation
    file.addDomainEvent(
      new FileCopyInitiatedEvent(
        file._id,
        params.sourceFileId,
        file._userId,
        file._filename,
        file._size.getBytes(),
        file._path,
      ),
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
    targetApps?: string[];
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
      data.targetApps || [],
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
    this._userId = userId;
    this._updatedAt = new Date();
  }

  /** Solo cambia el nombre "original" (no el key real). */
  public rename(newOriginalName: string): void {
    this._originalName = newOriginalName;
    this._updatedAt = new Date();
  }

  /** Cambia el filename y reconstruye el objectKey. */
  public renameFilename(newFilename: string): void {
    const oldFilename = this._filename;
    const oldObjectKey = this._objectKey.toString();

    this._filename = newFilename;
    this._objectKey = ObjectKey.join(this._path, this._filename);
    this._updatedAt = new Date();

    const newObjectKey = this._objectKey.toString();

    // Emitir evento de renombrado
    this.addDomainEvent(
      new FileRenamedEvent(
        this._id,
        this._userId,
        this._path,
        oldFilename,
        newFilename,
        oldObjectKey,
        newObjectKey,
      ),
    );
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

  public updateLastActivity(): void {
    this._updatedAt = new Date();
  }

  public markAsUploading(): void {
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

  public markAsCopying(): void {
    if (!this._status.isCopying()) {
      const oldStatus = this._status;
      this._status = FileStatus.copying();
      this._updatedAt = new Date();

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
    // Security requirement 6: Only UPLOADED files can be deleted
    return this._status.isUploaded();
  }

  public canBeMoved(): boolean {
    // Security requirement 5: Only UPLOADED files can be moved
    return this._status.isUploaded() && !this._status.isCopying();
  }

  public canBeRenamed(): boolean {
    // Security requirement 4: Only UPLOADED files can be renamed
    return this._status.isUploaded() && !this._status.isCopying();
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
