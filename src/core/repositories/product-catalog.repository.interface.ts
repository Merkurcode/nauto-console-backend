import { ProductCatalog } from '@core/entities/product-catalog.entity';

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
  upsert(productCatalog: ProductCatalog): Promise<ProductCatalog>;
  delete(id: string, companyId: string): Promise<void>;
  exists(id: string, companyId: string): Promise<boolean>;
}
