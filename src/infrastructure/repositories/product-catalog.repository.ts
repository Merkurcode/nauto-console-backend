import { Injectable, Inject, Optional, BadRequestException } from '@nestjs/common';
import { ProductCatalog } from '@core/entities/product-catalog.entity';
import {
  IProductCatalogRepository,
  ISearchProductCatalogRow,
  ISearchProductsParams,
  ISearchProductsResult,
} from '@core/repositories/product-catalog.repository.interface';
import { PrismaService } from '@infrastructure/database/prisma/prisma.service';
import { TransactionContextService } from '@infrastructure/database/prisma/transaction-context.service';
import { ProductCatalog as PrismaProductCatalog, PaymentOption, $Enums } from '@prisma/client';
import { BaseRepository } from './base.repository';
import { LOGGER_SERVICE } from '@shared/constants/tokens';
import { ILogger } from '@core/interfaces/logger.interface';
import { RequestCacheService } from '@infrastructure/caching/request-cache.service';
import { Decimal } from '@prisma/client/runtime/library';
import { ISearchProductCatalogResponse } from '@application/dtos/_responses/product-catalog/product-catalog.response';

@Injectable()
export class ProductCatalogRepository
  extends BaseRepository<ProductCatalog>
  implements IProductCatalogRepository
{
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TransactionContextService)
    private readonly transactionContext: TransactionContextService,
    @Optional() @Inject(LOGGER_SERVICE) private readonly logger?: ILogger,
    @Optional() _requestCache?: RequestCacheService,
  ) {
    logger?.setContext(ProductCatalogRepository.name);
    super(logger, undefined);
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

  async findByBulkRequestId(
    bulkRequestId: string,
    companyId: string,
    limit?: number,
    offset?: number,
  ): Promise<ProductCatalog[]> {
    return this.executeWithErrorHandling('findByBulkRequestId', async () => {
      const records = await this.client.productCatalog.findMany({
        where: {
          bulkRequestId,
          companyId,
        },
        orderBy: { sourceRowNumber: 'asc' }, // Order by sourceRowNumber ascending
        take: limit,
        skip: offset,
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
          link: productCatalog.link || null,
          sourceFileName: productCatalog.sourceFileName || null,
          sourceRowNumber: productCatalog.sourceRowNumber || null,
          langCode: productCatalog.langCode || null,
          bulkRequestId: productCatalog.bulkRequestId || null,
          isVisible: productCatalog.isVisible,
          metadata: productCatalog.metadata || null,
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
          link: productCatalog.link || null,
          sourceFileName: productCatalog.sourceFileName || null,
          sourceRowNumber: productCatalog.sourceRowNumber || null,
          langCode: productCatalog.langCode || null,
          bulkRequestId: productCatalog.bulkRequestId || null,
          isVisible: productCatalog.isVisible,
          metadata: productCatalog.metadata || null,
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

  async searchProducts(params: ISearchProductsParams): Promise<ISearchProductsResult> {
    return this.executeWithErrorHandling('searchProducts', async () => {
      // Defaults + guardas
      const limit = Math.min(Math.max(params.limit ?? 20, 1), 1000);
      const offset = Math.max(params.offset ?? 0, 0);
      const onlyVisible =
        params.onlyVisible === undefined || params.onlyVisible === null ? true : params.onlyVisible;

      // Sanitiza strings vacíos -> null (para que el SQL no filtre por cadenas vacías)
      const norm = <T extends string | null | undefined>(v: T) =>
        v !== undefined && v !== null && String(v).trim() === '' ? (null as T) : v;

      const companyId = params.companyId;
      const query = norm(params.query);
      const type = norm(params.type);
      const subcategory = norm(params.subcategory);

      const minPrice = params.minPrice ?? null;
      const maxPrice = params.maxPrice ?? null;

      let rows: ISearchProductCatalogRow[];

      try {
        rows = await this.client.$queryRaw<ISearchProductCatalogRow[]>`
        SELECT *
        FROM public.search_product_catalog(
          ${companyId}::text,
          ${query}::text,
          ${limit}::integer,
          ${offset}::integer,
          ${onlyVisible}::boolean,
          ${minPrice}::decimal,
          ${maxPrice}::decimal,
          ${type}::text,
          ${subcategory}::text,
          ${this.normalizePaymentOptions(params.paymentOptions) ?? null}::"PaymentOption"[]
        );
      `;
      } catch (e) {
        this.logger.error(e.message ?? e);
        throw new BadRequestException();
      }

      const products: ISearchProductCatalogResponse[] = rows.map(r => ({
        id: r.id,
        industry: r.industry,
        productService: r.productService,
        type: r.type,
        subcategory: r.subcategory,
        listPrice: new Decimal(r.listPrice).toNumber(),
        paymentOptions: r.paymentOptions,
        description: r.description,
        companyId: r.companyId,
        createdBy: r.createdBy,
        updatedBy: r.updatedBy,
        link: r.link,
        sourceFileName: r.sourceFileName,
        sourceRowNumber: r.sourceRowNumber,
        langCode: r.langCode,
        bulkRequestId: r.bulkRequestId,
        isVisible: r.isVisible,
        metadata: r.metadata,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        rank: r.rank,
      }));

      const totalCount = rows.length > 0 ? Number(rows[0].total_count) : 0;

      // (Opcional) hasMore, útil para paginado
      const hasMore = offset + products.length < totalCount;

      return { products, totalCount, hasMore };
    });
  }

  private normalizePaymentOptions(input: unknown): $Enums.PaymentOption[] | null {
    if (input === null) return null;

    if (Array.isArray(input)) {
      return (input as $Enums.PaymentOption[]).length ? (input as $Enums.PaymentOption[]) : null;
    }

    if (typeof input === 'string') {
      const arr = input
        .split(',')
        .map(s => s.trim())
        .filter(Boolean) as $Enums.PaymentOption[];

      return arr.length ? arr : null;
    }

    // Cualquier otro tipo: ignora filtro
    return null;
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
      link: record.link,
      sourceFileName: record.sourceFileName,
      sourceRowNumber: record.sourceRowNumber,
      langCode: record.langCode,
      bulkRequestId: record.bulkRequestId,
      isVisible: record.isVisible,
      metadata: (record.metadata as Record<string, string>) || undefined,
      updatedBy: record.updatedBy,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }
}
