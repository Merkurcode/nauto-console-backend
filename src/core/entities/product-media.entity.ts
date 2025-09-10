import { AggregateRoot } from '@core/events/domain-event.base';
import { ProductMediaId } from '@core/value-objects/product-media-id.vo';
import { FileId } from '@core/value-objects/file-id.vo';
import { ProductCatalogId } from '@core/value-objects/product-catalog-id.vo';
import { CompanyId } from '@core/value-objects/company-id.vo';
import { UserId } from '@core/value-objects/user-id.vo';
import { FileType } from '@prisma/client';
import { InvalidValueObjectException } from '@core/exceptions/domain-exceptions';
import {
  ProductMediaCreatedEvent,
  ProductMediaDeletedEvent,
  ProductMediaFavoriteChangedEvent,
  ProductMediaFileNameUpdatedEvent,
  ProductMediaDescriptionUpdatedEvent,
  ProductMediaTagsUpdatedEvent,
} from '@core/events/product-media.events';

export class ProductMedia extends AggregateRoot {
  private readonly _id: ProductMediaId;
  private readonly _fileId: FileId;
  private _fileType: FileType;
  private _fav: boolean;
  private readonly _productId: ProductCatalogId;
  private readonly _companyId: CompanyId;
  private readonly _createdBy: UserId;

  // NUEVO: Campos opcionales para multimedia
  private _description?: string;
  private _tags?: string;

  private readonly _createdAt: Date;
  private _updatedAt: Date;

  private constructor(
    id: ProductMediaId,
    fileId: FileId,
    fileType: FileType,
    fav: boolean,
    productId: ProductCatalogId,
    companyId: CompanyId,
    createdBy: UserId,
    description?: string,
    tags?: string,
    createdAt?: Date,
    updatedAt?: Date,
  ) {
    super();
    this._id = id;
    this._fileId = fileId;
    this._fileType = fileType;
    this._fav = fav;
    this._productId = productId;
    this._companyId = companyId;
    this._createdBy = createdBy;
    this._description = description;
    this._tags = tags;
    this._createdAt = createdAt || new Date();
    this._updatedAt = updatedAt || new Date();

    this.validateFileType();
    this.validateTags();
  }

  static create(data: {
    fileId: string;
    fileType: FileType;
    fav?: boolean;
    productId: string;
    companyId: string;
    createdBy: string;
    description?: string;
    tags?: string;
  }): ProductMedia {
    const id = ProductMediaId.create(crypto.randomUUID());
    const fileId = FileId.fromString(data.fileId);
    const productId = ProductCatalogId.create(data.productId);
    const companyId = CompanyId.fromString(data.companyId);
    const createdBy = UserId.fromString(data.createdBy);
    const fav = data.fav || false;

    const productMedia = new ProductMedia(
      id,
      fileId,
      data.fileType,
      fav,
      productId,
      companyId,
      createdBy,
      data.description,
      data.tags,
    );

    productMedia.addDomainEvent(
      new ProductMediaCreatedEvent(id, fileId, data.fileType, productId, companyId, createdBy, fav),
    );

    return productMedia;
  }

  static fromData(data: {
    id: string;
    fileId: string;
    fileType: FileType;
    fav: boolean;
    productId: string;
    companyId: string;
    createdBy: string;
    description?: string | null;
    tags?: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): ProductMedia {
    const id = ProductMediaId.create(data.id);
    const fileId = FileId.fromString(data.fileId);
    const productId = ProductCatalogId.create(data.productId);
    const companyId = CompanyId.fromString(data.companyId);
    const createdBy = UserId.fromString(data.createdBy);

    return new ProductMedia(
      id,
      fileId,
      data.fileType,
      data.fav,
      productId,
      companyId,
      createdBy,
      data.description || undefined,
      data.tags || undefined,
      data.createdAt,
      data.updatedAt,
    );
  }

  private validateFileType(): void {
    const validTypes = Object.values(FileType);
    if (!validTypes.includes(this._fileType)) {
      throw new InvalidValueObjectException(`Invalid file type: ${this._fileType}`);
    }
  }

  private validateTags(): void {
    if (this._tags) {
      // Basic validation for tags format: should start with # and be space-separated
      const tags = this._tags.trim().split(/\s+/);
      for (const tag of tags) {
        if (!tag.startsWith('#') || tag.length < 2) {
          throw new InvalidValueObjectException(
            `Invalid tag format: "${tag}". Tags should start with # and have at least one character after #.`,
          );
        }
      }
    }
  }

  // Getters
  get id(): ProductMediaId {
    return this._id;
  }

  get fileId(): FileId {
    return this._fileId;
  }

  get fileType(): FileType {
    return this._fileType;
  }

  get fav(): boolean {
    return this._fav;
  }

  get productId(): ProductCatalogId {
    return this._productId;
  }

  get companyId(): CompanyId {
    return this._companyId;
  }

  get createdBy(): UserId {
    return this._createdBy;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  get description(): string | undefined {
    return this._description;
  }

  get tags(): string | undefined {
    return this._tags;
  }

  // Business methods
  setFavorite(updatedBy: string, previousFavoriteMediaId?: ProductMediaId): void {
    if (this._fav) return;

    this._fav = true;
    this._updatedAt = new Date();

    this.addDomainEvent(
      new ProductMediaFavoriteChangedEvent(
        this._id,
        this._productId,
        this._companyId,
        UserId.fromString(updatedBy),
        true,
        previousFavoriteMediaId,
      ),
    );
  }

  unsetFavorite(updatedBy: string): void {
    if (!this._fav) return;

    this._fav = false;
    this._updatedAt = new Date();

    this.addDomainEvent(
      new ProductMediaFavoriteChangedEvent(
        this._id,
        this._productId,
        this._companyId,
        UserId.fromString(updatedBy),
        false,
      ),
    );
  }

  updateFileName(newFileName: string, previousFileName: string, updatedBy: string): void {
    this._updatedAt = new Date();

    this.addDomainEvent(
      new ProductMediaFileNameUpdatedEvent(
        this._id,
        this._fileId,
        this._productId,
        this._companyId,
        UserId.fromString(updatedBy),
        newFileName,
        previousFileName,
      ),
    );
  }

  updateDescription(description: string | undefined, updatedBy: string): void {
    if (this._description === description) return;

    const previousDescription = this._description;
    this._description = description;
    this._updatedAt = new Date();

    this.addDomainEvent(
      new ProductMediaDescriptionUpdatedEvent(
        this._id,
        this._productId,
        this._companyId,
        UserId.fromString(updatedBy),
        description,
        previousDescription,
      ),
    );
  }

  updateTags(tags: string | undefined, updatedBy: string): void {
    if (this._tags === tags) return;

    const previousTags = this._tags;
    this._tags = tags;

    if (tags) {
      this.validateTags();
    }

    this._updatedAt = new Date();

    this.addDomainEvent(
      new ProductMediaTagsUpdatedEvent(
        this._id,
        this._productId,
        this._companyId,
        UserId.fromString(updatedBy),
        tags,
        previousTags,
      ),
    );
  }

  markForDeletion(deletedBy: string): void {
    this.addDomainEvent(
      new ProductMediaDeletedEvent(
        this._id,
        this._fileId,
        this._fileType,
        this._productId,
        this._companyId,
        UserId.fromString(deletedBy),
      ),
    );
  }

  belongsToCompany(companyId: string): boolean {
    return this._companyId.getValue() === companyId;
  }

  belongsToProduct(productId: string): boolean {
    return this._productId.getValue() === productId;
  }

  isOwnedBy(userId: string): boolean {
    return this._createdBy.getValue() === userId;
  }

  static mapMimeTypeToFileType(mimeType: string): FileType {
    if (!mimeType) return FileType.OTHER;

    if (mimeType.startsWith('image/')) return FileType.IMAGE;
    if (mimeType.startsWith('video/')) return FileType.VIDEO;
    if (mimeType.startsWith('audio/')) return FileType.AUDIO;
    if (
      mimeType.includes('pdf') ||
      mimeType.includes('document') ||
      mimeType.includes('text/') ||
      mimeType.includes('application/')
    ) {
      return FileType.DOCUMENT;
    }

    return FileType.OTHER;
  }
}
