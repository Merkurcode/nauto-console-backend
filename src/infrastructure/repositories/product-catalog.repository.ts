import { Injectable, Inject, Optional } from '@nestjs/common';
import { ProductCatalog } from '@core/entities/product-catalog.entity';
import { IProductCatalogRepository } from '@core/repositories/product-catalog.repository.interface';
import { PrismaService } from '@infrastructure/database/prisma/prisma.service';
import { TransactionContextService } from '@infrastructure/database/prisma/transaction-context.service';
import { ProductCatalog as PrismaProductCatalog, PaymentOption } from '@prisma/client';
import { BaseRepository } from './base.repository';
import { LOGGER_SERVICE } from '@shared/constants/tokens';
import { ILogger } from '@core/interfaces/logger.interface';
import { RequestCacheService } from '@infrastructure/caching/request-cache.service';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class ProductCatalogRepository
  extends BaseRepository<ProductCatalog>
  implements IProductCatalogRepository
{
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TransactionContextService)
    private readonly transactionContext: TransactionContextService,
    @Optional() @Inject(LOGGER_SERVICE) logger?: ILogger,
    @Optional() requestCache?: RequestCacheService,
  ) {
    super(logger, requestCache);
  }

  private get client() {
    return this.transactionContext.getTransactionClient() || this.prisma;
  }

  async findById(id: string, companyId: string): Promise<ProductCatalog | null> {
    return this.executeWithErrorHandling(
      'findById',
      async () => {
        const record = await this.client.productCatalog.findFirst({
          where: {
            id,
            companyId,
          },
        });

        if (!record) {
          return null;
        }

        return this.mapToModel(record);
      },
      undefined,
      { id, companyId },
    );
  }

  async findByCompanyId(companyId: string): Promise<ProductCatalog[]> {
    return this.executeWithErrorHandling('findByCompanyId', async () => {
      const records = await this.client.productCatalog.findMany({
        where: { companyId },
        orderBy: { createdAt: 'desc' },
      });

      return records.map(record => this.mapToModel(record));
    });
  }

  async findByIndustry(industry: string, companyId: string): Promise<ProductCatalog[]> {
    return this.executeWithErrorHandling('findByIndustry', async () => {
      const records = await this.client.productCatalog.findMany({
        where: {
          industry,
          companyId,
        },
        orderBy: { createdAt: 'desc' },
      });

      return records.map(record => this.mapToModel(record));
    });
  }

  async findByType(type: string, companyId: string): Promise<ProductCatalog[]> {
    return this.executeWithErrorHandling('findByType', async () => {
      const records = await this.client.productCatalog.findMany({
        where: {
          type,
          companyId,
        },
        orderBy: { createdAt: 'desc' },
      });

      return records.map(record => this.mapToModel(record));
    });
  }

  async findBySubcategory(subcategory: string, companyId: string): Promise<ProductCatalog[]> {
    return this.executeWithErrorHandling('findBySubcategory', async () => {
      const records = await this.client.productCatalog.findMany({
        where: {
          subcategory,
          companyId,
        },
        orderBy: { createdAt: 'desc' },
      });

      return records.map(record => this.mapToModel(record));
    });
  }

  async upsert(productCatalog: ProductCatalog): Promise<ProductCatalog> {
    return this.executeWithErrorHandling('upsert', async () => {
      const record = await this.client.productCatalog.upsert({
        where: {
          id_companyId: {
            id: productCatalog.id.getValue(),
            companyId: productCatalog.companyId.getValue(),
          },
        },
        update: {
          industry: productCatalog.industry,
          productService: productCatalog.productService,
          type: productCatalog.type,
          subcategory: productCatalog.subcategory,
          listPrice: productCatalog.listPrice
            ? new Decimal(productCatalog.listPrice.getValue())
            : null,
          paymentOptions: productCatalog.paymentOptions,
          description: productCatalog.description || null,
          updatedBy: productCatalog.updatedBy?.getValue() || null,
          updatedAt: new Date(),
        },
        create: {
          id: productCatalog.id.getValue(),
          industry: productCatalog.industry,
          productService: productCatalog.productService,
          type: productCatalog.type,
          subcategory: productCatalog.subcategory,
          listPrice: productCatalog.listPrice
            ? new Decimal(productCatalog.listPrice.getValue())
            : null,
          paymentOptions: productCatalog.paymentOptions,
          description: productCatalog.description || null,
          companyId: productCatalog.companyId.getValue(),
          createdBy: productCatalog.createdBy.getValue(),
          updatedBy: productCatalog.updatedBy?.getValue() || null,
        },
      });

      return this.mapToModel(record);
    });
  }

  async delete(id: string, companyId: string): Promise<void> {
    return this.executeWithErrorHandling('delete', async () => {
      await this.client.productCatalog.delete({
        where: {
          id_companyId: {
            id,
            companyId,
          },
        },
      });
    });
  }

  async exists(id: string, companyId: string): Promise<boolean> {
    return this.executeWithErrorHandling('exists', async () => {
      const count = await this.client.productCatalog.count({
        where: {
          id,
          companyId,
        },
      });

      return count > 0;
    });
  }

  private mapToModel(record: PrismaProductCatalog): ProductCatalog {
    return ProductCatalog.fromData({
      id: record.id,
      industry: record.industry,
      productService: record.productService,
      type: record.type,
      subcategory: record.subcategory,
      listPrice: record.listPrice ? record.listPrice.toNumber() : null,
      paymentOptions: record.paymentOptions as PaymentOption[],
      companyId: record.companyId,
      createdBy: record.createdBy,
      description: record.description || undefined,
      updatedBy: record.updatedBy,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }
}
