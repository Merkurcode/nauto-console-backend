import { ProductCatalog } from '@core/entities/product-catalog.entity';
import { PaymentOption } from '@prisma/client';
import { ISearchProductCatalogResponse } from '@application/dtos/_responses/product-catalog/product-catalog.response';
import { Decimal } from '@prisma/client/runtime/library';

export interface ISearchProductCatalogRow {
  id: string;
  industry: string;
  productService: string;
  type: string;
  subcategory: string;
  listPrice: Decimal;
  paymentOptions: PaymentOption[];
  description: string;
  companyId: string;
  createdBy: string;
  updatedBy: string;
  link: string;
  sourceFileName: string;
  sourceRowNumber: number;
  langCode: string;
  bulkRequestId: string;
  isVisible: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  rank: number;
  total_count: bigint; // viene de la función SQL
}

export interface ISearchProductsParams {
  companyId: string;
  query?: string;
  limit: number;
  offset: number;
  onlyVisible: boolean;
  minPrice?: number;
  maxPrice?: number;
  type?: string;
  subcategory?: string;
  paymentOptions?: PaymentOption[];
}

export interface ISearchProductsResult {
  products: ISearchProductCatalogResponse[];
  totalCount: number;
  hasMore?: boolean;
}

export interface IProductCatalogRepository {
  findById(id: string, companyId: string): Promise<ProductCatalog | null>;
  findByCompanyId(companyId: string): Promise<ProductCatalog[]>;
  findByIndustry(industry: string, companyId: string): Promise<ProductCatalog[]>;
  findByType(type: string, companyId: string): Promise<ProductCatalog[]>;
  findBySubcategory(subcategory: string, companyId: string): Promise<ProductCatalog[]>;
  findByBulkRequestId(
    bulkRequestId: string,
    companyId: string,
    limit?: number,
    offset?: number,
  ): Promise<ProductCatalog[]>;
  searchProducts(params: ISearchProductsParams): Promise<ISearchProductsResult>;
  upsert(productCatalog: ProductCatalog): Promise<ProductCatalog>;
  delete(id: string, companyId: string): Promise<void>;
  exists(id: string, companyId: string): Promise<boolean>;
}
