import { DomainEvent } from '@core/events/domain-event.base';
import { ProductCatalogId } from '@core/value-objects/product-catalog-id.vo';
import { CompanyId } from '@core/value-objects/company-id.vo';
import { UserId } from '@core/value-objects/user-id.vo';
import { Price } from '@core/value-objects/price.vo';
import { PaymentOption } from '@prisma/client';

export class ProductCatalogCreatedEvent extends DomainEvent {
  constructor(
    public readonly productCatalogId: ProductCatalogId,
    public readonly industry: string,
    public readonly productService: string,
    public readonly type: string,
    public readonly subcategory: string,
    public readonly listPrice: Price | null,
    public readonly paymentOptions: PaymentOption[],
    public readonly companyId: CompanyId,
    public readonly createdBy: UserId,
    public readonly description?: string,
  ) {
    super();
  }

  getEventName(): string {
    return 'product_catalog.created';
  }
}

export class ProductCatalogUpdatedEvent extends DomainEvent {
  constructor(
    public readonly productCatalogId: ProductCatalogId,
    public readonly companyId: CompanyId,
    public readonly updatedBy: UserId,
    public readonly changes: {
      industry?: string;
      productService?: string;
      type?: string;
      subcategory?: string;
      listPrice?: Price | null;
      paymentOptions?: PaymentOption[];
      description?: string;
    },
    public readonly previousValues: {
      industry?: string;
      productService?: string;
      type?: string;
      subcategory?: string;
      listPrice?: Price | null;
      paymentOptions?: PaymentOption[];
      description?: string;
    },
  ) {
    super();
  }

  getEventName(): string {
    return 'product_catalog.updated';
  }
}

export class ProductCatalogDeletedEvent extends DomainEvent {
  constructor(
    public readonly productCatalogId: ProductCatalogId,
    public readonly industry: string,
    public readonly productService: string,
    public readonly companyId: CompanyId,
    public readonly deletedBy: UserId,
  ) {
    super();
  }

  getEventName(): string {
    return 'product_catalog.deleted';
  }
}
