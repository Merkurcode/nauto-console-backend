import { Injectable, Inject } from '@nestjs/common';
import { ProductCatalog } from '@core/entities/product-catalog.entity';
import { IProductCatalogRepository } from '@core/repositories/product-catalog.repository.interface';
import {
  PRODUCT_CATALOG_REPOSITORY,
  LOGGER_SERVICE,
  BULK_PROCESSING_REQUEST_REPOSITORY,
} from '@shared/constants/tokens';
import { ILogger } from '@core/interfaces/logger.interface';
import { EntityNotFoundException } from '@core/exceptions/domain-exceptions';
import { UnauthorizedCatalogAccessException } from '@core/exceptions/product-catalog.exceptions';
import { PaymentOption } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { UnauthorizedBulkProcessingRequestAccessException } from '@core/exceptions/bulk-processing.exceptions';
import { IBulkProcessingRequestRepository } from '@core/repositories/bulk-processing-request.repository.interface';

@Injectable()
export class ProductCatalogService {
  constructor(
    @Inject(BULK_PROCESSING_REQUEST_REPOSITORY)
    private readonly bulkProcessingRequestRepository: IBulkProcessingRequestRepository,
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
      link?: string;
      sourceFileName?: string;
      sourceRowNumber?: number;
      langCode?: string;
      bulkRequestId?: string;
      isVisible?: boolean;
      metadata?: Record<string, string>;
      ignoreIsVisibleIfExists?: boolean;
    },
    companyId: string,
    createdBy: string,
  ): Promise<ProductCatalog> {
    // Generate UUID if id is not provided
    const productId = data.id || uuidv4();

    // Check if product exists
    const existingProduct = await this.productCatalogRepository.findById(productId, companyId);

    if (existingProduct) {
      if (!existingProduct.belongsToCompany(companyId)) {
        throw new UnauthorizedCatalogAccessException(productId, companyId);
      }

      // Merge metadata - copy existing metadata and add new values
      let mergedMetadata: Record<string, string> | undefined = undefined;
      if (data.metadata || existingProduct.metadata) {
        mergedMetadata = {
          ...(existingProduct.metadata || {}), // Copy existing metadata first
          ...(data.metadata || {}), // Add new metadata values
        };

        // Remove any keys with empty values
        mergedMetadata = Object.fromEntries(
          Object.entries(mergedMetadata).filter(([_, value]) => value && value.trim()),
        );

        // If no metadata remains, set to undefined
        if (Object.keys(mergedMetadata).length === 0) {
          mergedMetadata = undefined;
        }
      }

      // Update existing product
      existingProduct.update({
        industry: data.industry,
        productService: data.productService,
        type: data.type,
        subcategory: data.subcategory,
        listPrice: data.listPrice,
        paymentOptions: data.paymentOptions,
        description: data.description,
        link: data.link,
        sourceFileName: data.sourceFileName,
        sourceRowNumber: data.sourceRowNumber,
        langCode: data.langCode,
        updatedBy: createdBy,
      });

      // Update metadata separately using entity method if needed
      if (mergedMetadata !== existingProduct.metadata) {
        // Create new instance with merged metadata for proper update
        const updatedProduct = ProductCatalog.fromData({
          id: existingProduct.id.getValue(),
          industry: existingProduct.industry,
          productService: existingProduct.productService,
          type: existingProduct.type,
          subcategory: existingProduct.subcategory,
          listPrice: existingProduct.listPrice?.getValue() || null,
          paymentOptions: existingProduct.paymentOptions,
          companyId: existingProduct.companyId.getValue(),
          createdBy: existingProduct.createdBy.getValue(),
          description: existingProduct.description,
          link: existingProduct.link,
          sourceFileName: existingProduct.sourceFileName,
          sourceRowNumber: existingProduct.sourceRowNumber,
          langCode: existingProduct.langCode,
          bulkRequestId: existingProduct.bulkRequestId,
          isVisible:
            data.isVisible !== undefined
              ? data.ignoreIsVisibleIfExists
                ? existingProduct.isVisible
                : data.isVisible
              : existingProduct.isVisible,
          metadata: mergedMetadata,
          updatedBy: existingProduct.updatedBy?.getValue() || null,
          createdAt: existingProduct.createdAt,
          updatedAt: existingProduct.updatedAt,
        });

        return await this.productCatalogRepository.upsert(updatedProduct);
      }

      return await this.productCatalogRepository.upsert(existingProduct);
    } else {
      // Create new product
      const productCatalog = ProductCatalog.create({
        ...data,
        id: productId,
        companyId,
        createdBy,
        isVisible: data.isVisible !== undefined ? data.isVisible : true, // Default to visible for new products
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
      link?: string;
      sourceFileName?: string;
      sourceRowNumber?: number;
      langCode?: string;
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

  async updateProductVisibility(
    id: string,
    companyId: string,
    isVisible: boolean,
    updatedBy: string,
    forceOverwrite: boolean = false,
  ): Promise<ProductCatalog> {
    const productCatalog = await this.productCatalogRepository.findById(id, companyId);

    if (!productCatalog) {
      throw new EntityNotFoundException('ProductCatalog', id);
    }

    if (!productCatalog.belongsToCompany(companyId)) {
      throw new UnauthorizedCatalogAccessException(id, companyId);
    }

    // Only check bulk processing restrictions if not forcing overwrite
    if (!forceOverwrite) {
      // Check if we should overwrite the current visibility
      this.logger.debug(
        `Product ${id} keeping current visibility ${productCatalog.isVisible} (forceOverwrite=false)`,
      );

      // Also check bulk processing restrictions
      const bulkProcessing = await this.bulkProcessingRequestRepository.findByIdAndCompany(
        productCatalog.bulkRequestId,
        companyId,
      );
      if (bulkProcessing) {
        if (bulkProcessing.isInProgress() && isVisible !== undefined && isVisible !== null) {
          throw new UnauthorizedBulkProcessingRequestAccessException(
            bulkProcessing.id.toString(),
            companyId,
          );
        }
      }

      // Return early if not forcing overwrite
      return productCatalog;
    }

    // Use the entity's update method to change visibility
    productCatalog.update({
      updatedBy,
    });

    // Since the entity doesn't have a direct method to update visibility,
    // we'll create the entity again with the new visibility state
    const updatedProduct = ProductCatalog.fromData({
      id: productCatalog.id.getValue(),
      industry: productCatalog.industry,
      productService: productCatalog.productService,
      type: productCatalog.type,
      subcategory: productCatalog.subcategory,
      listPrice: productCatalog.listPrice?.getValue() || null,
      paymentOptions: productCatalog.paymentOptions,
      companyId: productCatalog.companyId.getValue(),
      createdBy: productCatalog.createdBy.getValue(),
      description: productCatalog.description,
      link: productCatalog.link,
      sourceFileName: productCatalog.sourceFileName,
      sourceRowNumber: productCatalog.sourceRowNumber,
      langCode: productCatalog.langCode,
      bulkRequestId: productCatalog.bulkRequestId,
      isVisible: isVisible,
      updatedBy: updatedBy,
      createdAt: productCatalog.createdAt,
      updatedAt: new Date(),
    });

    const result = await this.productCatalogRepository.upsert(updatedProduct);

    this.logger.log(
      `Product catalog visibility updated: ${id} -> ${isVisible} by user: ${updatedBy} in company: ${companyId}`,
    );

    return result;
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
