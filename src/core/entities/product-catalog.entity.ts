import { AggregateRoot } from '@core/events/domain-event.base';
import { ProductCatalogId } from '@core/value-objects/product-catalog-id.vo';
import { CompanyId } from '@core/value-objects/company-id.vo';
import { UserId } from '@core/value-objects/user-id.vo';
import { Price } from '@core/value-objects/price.vo';
import { PaymentOption } from '@prisma/client';
import { InvalidValueObjectException } from '@core/exceptions/domain-exceptions';
import {
  ProductCatalogCreatedEvent,
  ProductCatalogUpdatedEvent,
  ProductCatalogDeletedEvent,
} from '@core/events/product-catalog.events';

export class ProductCatalog extends AggregateRoot {
  private readonly _id: ProductCatalogId;
  private _industry: string;
  private _productService: string;
  private _type: string;
  private _subcategory: string;
  private _listPrice: Price | null;
  private _paymentOptions: PaymentOption[];
  private _description?: string;
  private readonly _companyId: CompanyId;
  private readonly _createdBy: UserId;
  private _updatedBy?: UserId;

  // NUEVO: Campos opcionales para carga masiva
  private _link?: string;
  private _sourceFileName?: string;
  private _sourceRowNumber?: number;
  private _langCode?: string;
  private _bulkRequestId?: string;
  private _isVisible: boolean;

  // Metadata JSON para URLs multimedia y otros datos
  private _metadata?: Record<string, string>;

  private readonly _createdAt: Date;
  private _updatedAt: Date;

  private constructor(
    id: ProductCatalogId,
    industry: string,
    productService: string,
    type: string,
    subcategory: string,
    listPrice: Price | null,
    paymentOptions: PaymentOption[],
    companyId: CompanyId,
    createdBy: UserId,
    description?: string,
    link?: string,
    sourceFileName?: string,
    sourceRowNumber?: number,
    langCode?: string,
    bulkRequestId?: string,
    isVisible?: boolean,
    metadata?: Record<string, string>,
    updatedBy?: UserId,
    createdAt?: Date,
    updatedAt?: Date,
  ) {
    super();
    this._id = id;
    this._industry = industry;
    this._productService = productService;
    this._type = type;
    this._subcategory = subcategory;
    this._listPrice = listPrice;
    this._paymentOptions = paymentOptions;
    this._companyId = companyId;
    this._createdBy = createdBy;
    this._description = description;
    this._link = link;
    this._sourceFileName = sourceFileName;
    this._sourceRowNumber = sourceRowNumber;
    this._langCode = langCode;
    this._bulkRequestId = bulkRequestId;
    this._isVisible = isVisible !== undefined ? isVisible : true;
    this._metadata = metadata;
    this._updatedBy = updatedBy;
    this._createdAt = createdAt || new Date();
    this._updatedAt = updatedAt || new Date();

    this.validatePaymentOptions();
    this.validateLangCode();
  }

  static create(data: {
    id: string;
    industry: string;
    productService: string;
    type: string;
    subcategory: string;
    listPrice?: number | null;
    paymentOptions: PaymentOption[];
    companyId: string;
    createdBy: string;
    description?: string;
    link?: string;
    sourceFileName?: string;
    sourceRowNumber?: number;
    langCode?: string;
    bulkRequestId?: string;
    isVisible?: boolean;
    metadata?: Record<string, string>;
  }): ProductCatalog {
    const catalogId = ProductCatalogId.create(data.id);
    const companyId = CompanyId.fromString(data.companyId);
    const createdBy = UserId.fromString(data.createdBy);
    const price =
      data.listPrice !== undefined && data.listPrice !== null ? Price.create(data.listPrice) : null;

    const productCatalog = new ProductCatalog(
      catalogId,
      data.industry,
      data.productService,
      data.type,
      data.subcategory,
      price,
      data.paymentOptions,
      companyId,
      createdBy,
      data.description,
      data.link,
      data.sourceFileName,
      data.sourceRowNumber,
      data.langCode,
      data.bulkRequestId,
      data.isVisible,
      data.metadata,
    );

    productCatalog.addDomainEvent(
      new ProductCatalogCreatedEvent(
        catalogId,
        data.industry,
        data.productService,
        data.type,
        data.subcategory,
        price,
        data.paymentOptions,
        companyId,
        createdBy,
        data.description,
      ),
    );

    return productCatalog;
  }

  static fromData(data: {
    id: string;
    industry: string;
    productService: string;
    type: string;
    subcategory: string;
    listPrice?: number | null;
    paymentOptions: PaymentOption[];
    companyId: string;
    createdBy: string;
    description?: string;
    link?: string | null;
    sourceFileName?: string | null;
    sourceRowNumber?: number | null;
    langCode?: string | null;
    bulkRequestId?: string | null;
    isVisible: boolean;
    metadata?: Record<string, string> | null;
    updatedBy?: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): ProductCatalog {
    const catalogId = ProductCatalogId.create(data.id);
    const companyId = CompanyId.fromString(data.companyId);
    const createdBy = UserId.fromString(data.createdBy);
    const updatedBy = data.updatedBy ? UserId.fromString(data.updatedBy) : undefined;
    const price =
      data.listPrice !== undefined && data.listPrice !== null ? Price.create(data.listPrice) : null;

    return new ProductCatalog(
      catalogId,
      data.industry,
      data.productService,
      data.type,
      data.subcategory,
      price,
      data.paymentOptions,
      companyId,
      createdBy,
      data.description,
      data.link || undefined,
      data.sourceFileName || undefined,
      data.sourceRowNumber || undefined,
      data.langCode || undefined,
      data.bulkRequestId || undefined,
      data.isVisible,
      data.metadata || undefined,
      updatedBy,
      data.createdAt,
      data.updatedAt,
    );
  }

  private validatePaymentOptions(): void {
    if (!this._paymentOptions || this._paymentOptions.length === 0) {
      throw new InvalidValueObjectException('At least one payment option is required');
    }

    const validOptions = Object.values(PaymentOption);
    for (const option of this._paymentOptions) {
      if (!validOptions.includes(option)) {
        throw new InvalidValueObjectException(`Invalid payment option: ${option}`);
      }
    }
  }

  private validateLangCode(): void {
    if (this._langCode) {
      // Basic validation for ISO/BCP47 language codes
      const langCodePattern = /^[a-z]{2,3}(-[A-Z]{2})?$/;
      if (!langCodePattern.test(this._langCode)) {
        throw new InvalidValueObjectException(
          `Invalid language code format: ${this._langCode}. Expected format: "es-MX", "en-US", "pt-BR"`,
        );
      }
    }
  }

  // Getters
  get id(): ProductCatalogId {
    return this._id;
  }

  get industry(): string {
    return this._industry;
  }

  get productService(): string {
    return this._productService;
  }

  get type(): string {
    return this._type;
  }

  get subcategory(): string {
    return this._subcategory;
  }

  get listPrice(): Price | null {
    return this._listPrice;
  }

  get paymentOptions(): PaymentOption[] {
    return [...this._paymentOptions];
  }

  get description(): string | undefined {
    return this._description;
  }

  get companyId(): CompanyId {
    return this._companyId;
  }

  get createdBy(): UserId {
    return this._createdBy;
  }

  get updatedBy(): UserId | undefined {
    return this._updatedBy;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  get link(): string | undefined {
    return this._link;
  }

  get sourceFileName(): string | undefined {
    return this._sourceFileName;
  }

  get sourceRowNumber(): number | undefined {
    return this._sourceRowNumber;
  }

  get langCode(): string | undefined {
    return this._langCode;
  }

  get bulkRequestId(): string | undefined {
    return this._bulkRequestId;
  }

  get isVisible(): boolean {
    return this._isVisible;
  }

  get metadata(): Record<string, string> | undefined {
    return this._metadata;
  }

  // Business methods
  update(data: {
    industry?: string;
    productService?: string;
    type?: string;
    subcategory?: string;
    listPrice?: number | null;
    paymentOptions?: PaymentOption[];
    description?: string;
    link?: string;
    sourceFileName?: string;
    sourceRowNumber?: number;
    langCode?: string;
    metadata?: Record<string, string>;
    isVisible?: boolean;
    updatedBy: string;
  }): void {
    const previousValues = {
      industry: this._industry,
      productService: this._productService,
      type: this._type,
      subcategory: this._subcategory,
      listPrice: this._listPrice,
      paymentOptions: [...this._paymentOptions],
      description: this._description,
      link: this._link,
      sourceFileName: this._sourceFileName,
      sourceRowNumber: this._sourceRowNumber,
      langCode: this._langCode,
      metadata: this._metadata ? { ...this._metadata } : undefined,
      isVisible: this._isVisible,
    };

    const changes: {
      industry?: string;
      productService?: string;
      type?: string;
      subcategory?: string;
      listPrice?: Price | null;
      paymentOptions?: PaymentOption[];
      description?: string;
      link?: string;
      sourceFileName?: string;
      sourceRowNumber?: number;
      langCode?: string;
      metadata?: Record<string, string>;
      isVisible?: boolean;
    } = {};

    if (data.industry !== undefined && data.industry !== this._industry) {
      this._industry = data.industry;
      changes.industry = data.industry;
    }
    if (data.productService !== undefined && data.productService !== this._productService) {
      this._productService = data.productService;
      changes.productService = data.productService;
    }
    if (data.type !== undefined && data.type !== this._type) {
      this._type = data.type;
      changes.type = data.type;
    }
    if (data.subcategory !== undefined && data.subcategory !== this._subcategory) {
      this._subcategory = data.subcategory;
      changes.subcategory = data.subcategory;
    }
    if (data.listPrice !== undefined) {
      const currentValue = this._listPrice?.getValue() ?? null;
      const newValue = data.listPrice;

      if (newValue !== currentValue) {
        this._listPrice = newValue !== null ? Price.create(newValue) : null;
        changes.listPrice = this._listPrice;
      }
    }
    if (data.paymentOptions !== undefined) {
      const optionsChanged =
        JSON.stringify(data.paymentOptions) !== JSON.stringify(this._paymentOptions);
      if (optionsChanged) {
        this._paymentOptions = data.paymentOptions;
        this.validatePaymentOptions();
        changes.paymentOptions = data.paymentOptions;
      }
    }
    if (data.description !== undefined && data.description !== this._description) {
      this._description = data.description;
      changes.description = data.description;
    }
    if (data.link !== undefined && data.link !== this._link) {
      this._link = data.link;
      changes.link = data.link;
    }
    if (data.sourceFileName !== undefined && data.sourceFileName !== this._sourceFileName) {
      this._sourceFileName = data.sourceFileName;
      changes.sourceFileName = data.sourceFileName;
    }
    if (data.sourceRowNumber !== undefined && data.sourceRowNumber !== this._sourceRowNumber) {
      this._sourceRowNumber = data.sourceRowNumber;
      changes.sourceRowNumber = data.sourceRowNumber;
    }
    if (data.langCode !== undefined && data.langCode !== this._langCode) {
      this._langCode = data.langCode;
      this.validateLangCode();
      changes.langCode = data.langCode;
    }
    if (data.metadata !== undefined) {
      // Compare metadata objects properly
      const currentMetadata = this._metadata || {};
      const newMetadata = data.metadata || {};
      const metadataChanged = JSON.stringify(currentMetadata) !== JSON.stringify(newMetadata);

      if (metadataChanged) {
        this._metadata = Object.keys(newMetadata).length > 0 ? newMetadata : undefined;
        changes.metadata = this._metadata;
      }
    }
    if (data.isVisible !== undefined && data.isVisible !== this._isVisible) {
      this._isVisible = data.isVisible;
      changes.isVisible = data.isVisible;
    }

    this._updatedBy = UserId.fromString(data.updatedBy);
    this._updatedAt = new Date();

    if (Object.keys(changes).length > 0) {
      this.addDomainEvent(
        new ProductCatalogUpdatedEvent(
          this._id,
          this._companyId,
          this._updatedBy,
          changes,
          previousValues,
        ),
      );
    }
  }

  belongsToCompany(companyId: string): boolean {
    return this._companyId.getValue() === companyId;
  }

  markForDeletion(deletedBy: string): void {
    this.addDomainEvent(
      new ProductCatalogDeletedEvent(
        this._id,
        this._industry,
        this._productService,
        this._companyId,
        UserId.fromString(deletedBy),
      ),
    );
  }
}
