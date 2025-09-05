import { DomainEvent } from '@core/events/domain-event.base';
import { ProductMediaId } from '@core/value-objects/product-media-id.vo';
import { CompanyId } from '@core/value-objects/company-id.vo';
import { UserId } from '@core/value-objects/user-id.vo';
import { FileId } from '@core/value-objects/file-id.vo';
import { ProductCatalogId } from '@core/value-objects/product-catalog-id.vo';
import { FileType } from '@prisma/client';

export class ProductMediaCreatedEvent extends DomainEvent {
  constructor(
    public readonly productMediaId: ProductMediaId,
    public readonly fileId: FileId,
    public readonly fileType: FileType,
    public readonly productId: ProductCatalogId,
    public readonly companyId: CompanyId,
    public readonly createdBy: UserId,
    public readonly fav: boolean,
  ) {
    super();
  }

  getEventName(): string {
    return 'product_media.created';
  }
}

export class ProductMediaUpdatedEvent extends DomainEvent {
  constructor(
    public readonly productMediaId: ProductMediaId,
    public readonly companyId: CompanyId,
    public readonly updatedBy: UserId,
    public readonly changes: {
      fileId?: FileId;
      fileType?: FileType;
      fav?: boolean;
    },
    public readonly previousValues: {
      fileId?: FileId;
      fileType?: FileType;
      fav?: boolean;
    },
  ) {
    super();
  }

  getEventName(): string {
    return 'product_media.updated';
  }
}

export class ProductMediaDeletedEvent extends DomainEvent {
  constructor(
    public readonly productMediaId: ProductMediaId,
    public readonly fileId: FileId,
    public readonly fileType: FileType,
    public readonly productId: ProductCatalogId,
    public readonly companyId: CompanyId,
    public readonly deletedBy: UserId,
  ) {
    super();
  }

  getEventName(): string {
    return 'product_media.deleted';
  }
}

export class ProductMediaFavoriteChangedEvent extends DomainEvent {
  constructor(
    public readonly productMediaId: ProductMediaId,
    public readonly productId: ProductCatalogId,
    public readonly companyId: CompanyId,
    public readonly updatedBy: UserId,
    public readonly newFavoriteStatus: boolean,
    public readonly previousFavoriteMediaId?: ProductMediaId,
  ) {
    super();
  }

  getEventName(): string {
    return 'product_media.favorite_changed';
  }
}

export class ProductMediaFileNameUpdatedEvent extends DomainEvent {
  constructor(
    public readonly productMediaId: ProductMediaId,
    public readonly fileId: FileId,
    public readonly productId: ProductCatalogId,
    public readonly companyId: CompanyId,
    public readonly updatedBy: UserId,
    public readonly newFileName: string,
    public readonly previousFileName: string,
  ) {
    super();
  }

  getEventName(): string {
    return 'product_media.file_name_updated';
  }
}
