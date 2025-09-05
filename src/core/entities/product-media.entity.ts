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
} from '@core/events/product-media.events';

export class ProductMedia extends AggregateRoot {
  private readonly _id: ProductMediaId;
  private readonly _fileId: FileId;
  private _fileType: FileType;
  private _fav: boolean;
  private readonly _productId: ProductCatalogId;
  private readonly _companyId: CompanyId;
  private readonly _createdBy: UserId;
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
    this._createdAt = createdAt || new Date();
    this._updatedAt = updatedAt || new Date();

    this.validateFileType();
  }

  static create(data: {
    fileId: string;
    fileType: FileType;
    fav?: boolean;
    productId: string;
    companyId: string;
    createdBy: string;
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
