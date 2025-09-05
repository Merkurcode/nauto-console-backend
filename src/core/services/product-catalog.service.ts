import { Injectable, Inject } from '@nestjs/common';
import { ProductCatalog } from '@core/entities/product-catalog.entity';
import { IProductCatalogRepository } from '@core/repositories/product-catalog.repository.interface';
import { PRODUCT_CATALOG_REPOSITORY, LOGGER_SERVICE } from '@shared/constants/tokens';
import { ILogger } from '@core/interfaces/logger.interface';
import { EntityNotFoundException } from '@core/exceptions/domain-exceptions';
import { UnauthorizedCatalogAccessException } from '@core/exceptions/product-catalog.exceptions';
import { PaymentOption } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ProductCatalogService {
  constructor(
    @Inject(PRODUCT_CATALOG_REPOSITORY)
    private readonly productCatalogRepository: IProductCatalogRepository,
    @Inject(LOGGER_SERVICE)
    private readonly logger: ILogger,
  ) {
    this.logger.setContext(ProductCatalogService.name);
  }

  async upsertProductCatalog(
    data: {
      id?: string;
      industry: string;
      productService: string;
      type: string;
      subcategory: string;
      listPrice?: number | null;
      paymentOptions: PaymentOption[];
      description?: string;
    },
    companyId: string,
    createdBy: string,
  ): Promise<ProductCatalog> {
    // Generate UUID if id is not provided
    const productId = data.id || uuidv4();

    // Check if product exists
    const existingProduct = await this.productCatalogRepository.findById(productId, companyId);

    if (existingProduct) {
      // Update existing product
      existingProduct.update({
        industry: data.industry,
        productService: data.productService,
        type: data.type,
        subcategory: data.subcategory,
        listPrice: data.listPrice,
        paymentOptions: data.paymentOptions,
        description: data.description,
        updatedBy: createdBy,
      });

      return await this.productCatalogRepository.upsert(existingProduct);
    } else {
      // Create new product
      const productCatalog = ProductCatalog.create({
        ...data,
        id: productId,
        companyId,
        createdBy,
      });

      return await this.productCatalogRepository.upsert(productCatalog);
    }
  }

  async updateProductCatalog(
    id: string,
    data: {
      industry?: string;
      productService?: string;
      type?: string;
      subcategory?: string;
      listPrice?: number | null;
      paymentOptions?: PaymentOption[];
      description?: string;
      technicalSheetId?: string | null;
      photosId?: string | null;
    },
    companyId: string,
    updatedBy: string,
  ): Promise<ProductCatalog> {
    const productCatalog = await this.productCatalogRepository.findById(id, companyId);

    if (!productCatalog) {
      throw new EntityNotFoundException('ProductCatalog', id);
    }

    if (!productCatalog.belongsToCompany(companyId)) {
      throw new UnauthorizedCatalogAccessException(id, companyId);
    }

    // File validation is now handled through ProductMedia

    productCatalog.update({
      ...data,
      updatedBy,
    });

    return await this.productCatalogRepository.upsert(productCatalog);
  }

  async getProductCatalogById(id: string, companyId: string): Promise<ProductCatalog> {
    const productCatalog = await this.productCatalogRepository.findById(id, companyId);

    if (!productCatalog) {
      throw new EntityNotFoundException('ProductCatalog', id);
    }

    if (!productCatalog.belongsToCompany(companyId)) {
      throw new UnauthorizedCatalogAccessException(id, companyId);
    }

    return productCatalog;
  }

  async getProductCatalogsByCompany(companyId: string): Promise<ProductCatalog[]> {
    return await this.productCatalogRepository.findByCompanyId(companyId);
  }

  async getProductCatalogsByIndustry(
    industry: string,
    companyId: string,
  ): Promise<ProductCatalog[]> {
    return await this.productCatalogRepository.findByIndustry(industry, companyId);
  }

  async getProductCatalogsByType(type: string, companyId: string): Promise<ProductCatalog[]> {
    return await this.productCatalogRepository.findByType(type, companyId);
  }

  async getProductCatalogsBySubcategory(
    subcategory: string,
    companyId: string,
  ): Promise<ProductCatalog[]> {
    return await this.productCatalogRepository.findBySubcategory(subcategory, companyId);
  }

  async deleteProductCatalog(id: string, companyId: string, userId?: string): Promise<void> {
    const productCatalog = await this.productCatalogRepository.findById(id, companyId);

    if (!productCatalog) {
      throw new EntityNotFoundException('ProductCatalog', id);
    }

    if (!productCatalog.belongsToCompany(companyId)) {
      throw new UnauthorizedCatalogAccessException(id, companyId);
    }

    await this.productCatalogRepository.delete(id, companyId);

    if (userId) {
      this.logger.log(`Product catalog deleted: ${id} by user: ${userId} in company: ${companyId}`);
    }
  }
}
