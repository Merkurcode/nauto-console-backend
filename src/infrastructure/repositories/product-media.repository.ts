import { Injectable, Inject, Optional } from '@nestjs/common';
import { PrismaService } from '@infrastructure/database/prisma/prisma.service';
import { TransactionContextService } from '@infrastructure/database/prisma/transaction-context.service';
import { IProductMediaRepository } from '@core/repositories/product-media.repository.interface';
import { ProductMedia } from '@core/entities/product-media.entity';
import { FileType, ProductMedia as PrismaProductMedia } from '@prisma/client';
import { ProductMediaNotFoundException } from '@core/exceptions/product-media.exceptions';
import { BaseRepository } from './base.repository';
import { LOGGER_SERVICE } from '@shared/constants/tokens';
import { ILogger } from '@core/interfaces/logger.interface';
import { RequestCacheService } from '@infrastructure/caching/request-cache.service';

@Injectable()
export class ProductMediaRepository
  extends BaseRepository<ProductMedia>
  implements IProductMediaRepository
{
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(TransactionContextService)
    private readonly transactionContext: TransactionContextService,
    @Optional() @Inject(LOGGER_SERVICE) logger?: ILogger,
    @Optional() _requestCache?: RequestCacheService,
  ) {
    logger?.setContext(ProductMediaRepository.name);
    super(logger, undefined);
  }

  private get client() {
    return this.transactionContext.getTransactionClient() || this.prisma;
  }

  async create(productMedia: ProductMedia): Promise<ProductMedia> {
    return this.executeWithErrorHandling('create', async () => {
      const data = await this.client.productMedia.create({
        data: {
          id: productMedia.id.getValue(),
          fileId: productMedia.fileId.getValue(),
          fileType: productMedia.fileType,
          fav: productMedia.fav,
          productId: productMedia.productId.getValue(),
          companyId: productMedia.companyId.getValue(),
          createdBy: productMedia.createdBy.getValue(),
          description: productMedia.description || null,
          tags: productMedia.tags || null,
          createdAt: productMedia.createdAt,
          updatedAt: productMedia.updatedAt,
        },
      });

      return this.mapToModel(data);
    });
  }

  async findById(id: string): Promise<ProductMedia | null> {
    return this.executeWithErrorHandling(
      'findById',
      async () => {
        const data = await this.client.productMedia.findUnique({
          where: { id },
        });

        return data ? this.mapToModel(data) : null;
      },
      undefined,
      { id },
    );
  }

  async findByIdAndCompany(
    id: string,
    companyId: string,
    cache: boolean = true,
  ): Promise<ProductMedia | null> {
    return this.executeWithErrorHandling(
      'findByIdAndCompany',
      async () => {
        const data = await this.client.productMedia.findFirst({
          where: {
            id,
            companyId,
          },
        });

        return data ? this.mapToModel(data) : null;
      },
      undefined,
      cache ? { id, companyId } : undefined,
    );
  }

  async findByProductId(productId: string, companyId: string): Promise<ProductMedia[]> {
    return this.executeWithErrorHandling('findByProductId', async () => {
      const dataList = await this.client.productMedia.findMany({
        where: {
          productId,
          companyId,
        },
        orderBy: [
          { fav: 'desc' }, // Favorites first
          { createdAt: 'asc' },
        ],
      });

      return dataList.map(data => this.mapToModel(data));
    });
  }

  async findByFileAndProduct(
    fileId: string,
    productId: string,
    companyId: string,
  ): Promise<ProductMedia | null> {
    return this.executeWithErrorHandling('findByFileAndProduct', async () => {
      const data = await this.client.productMedia.findFirst({
        where: {
          fileId,
          productId,
          companyId,
        },
      });

      return data ? this.mapToModel(data) : null;
    });
  }

  async findFavoriteByProductId(
    productId: string,
    companyId: string,
  ): Promise<ProductMedia | null> {
    return this.executeWithErrorHandling('findFavoriteByProductId', async () => {
      const data = await this.client.productMedia.findFirst({
        where: {
          productId,
          companyId,
          fav: true,
        },
      });

      return data ? this.mapToModel(data) : null;
    });
  }

  async findByFileType(fileType: FileType, companyId: string): Promise<ProductMedia[]> {
    return this.executeWithErrorHandling('findByFileType', async () => {
      const dataList = await this.client.productMedia.findMany({
        where: {
          fileType,
          companyId,
        },
        orderBy: [{ fav: 'desc' }, { createdAt: 'desc' }],
      });

      return dataList.map(data => this.mapToModel(data));
    });
  }

  async update(productMedia: ProductMedia): Promise<ProductMedia> {
    return this.executeWithErrorHandling('update', async () => {
      try {
        const data = await this.client.productMedia.update({
          where: {
            id: productMedia.id.getValue(),
          },
          data: {
            fileType: productMedia.fileType,
            fav: productMedia.fav,
            description: productMedia.description || null,
            tags: productMedia.tags || null,
            updatedAt: productMedia.updatedAt,
          },
        });

        return this.mapToModel(data);
      } catch (_error) {
        throw new ProductMediaNotFoundException(productMedia.id.getValue());
      }
    });
  }

  async delete(id: string, companyId: string): Promise<void> {
    return this.executeWithErrorHandling('delete', async () => {
      try {
        await this.client.productMedia.delete({
          where: {
            id,
            companyId,
          },
        });
      } catch (_error) {
        throw new ProductMediaNotFoundException(id);
      }
    });
  }

  async clearFavoriteForProductByType(
    productId: string,
    companyId: string,
    fileType: FileType,
  ): Promise<void> {
    return this.executeWithErrorHandling('clearFavoriteForProductByType', async () => {
      await this.client.productMedia.updateMany({
        where: {
          productId,
          companyId,
          fileType,
          fav: true,
        },
        data: {
          fav: false,
          updatedAt: new Date(),
        },
      });
    });
  }

  private mapToModel(record: PrismaProductMedia): ProductMedia {
    return ProductMedia.fromData({
      id: record.id,
      fileId: record.fileId,
      fileType: record.fileType,
      fav: record.fav,
      productId: record.productId,
      companyId: record.companyId,
      createdBy: record.createdBy,
      description: record.description,
      tags: record.tags,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }
}
