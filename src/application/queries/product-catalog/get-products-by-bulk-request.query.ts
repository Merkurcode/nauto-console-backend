import { IQuery, QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Injectable, Inject } from '@nestjs/common';
import { IProductCatalogRepository } from '@core/repositories/product-catalog.repository.interface';
import { PRODUCT_CATALOG_REPOSITORY } from '@shared/constants/tokens';

export class GetProductsByBulkRequestQuery implements IQuery {
  constructor(
    public readonly bulkRequestId: string,
    public readonly companyId: string,
    public readonly hasMultimediaOnly?: boolean,
  ) {}
}

export interface IProductWithMultimedia {
  id: string;
  sourceRowNumber: number;
  isVisible: boolean;
  metadata?: Record<string, string>;
}

@Injectable()
@QueryHandler(GetProductsByBulkRequestQuery)
export class GetProductsByBulkRequestQueryHandler
  implements IQueryHandler<GetProductsByBulkRequestQuery>
{
  private static readonly CHUNK_SIZE = 100;

  constructor(
    @Inject(PRODUCT_CATALOG_REPOSITORY)
    private readonly productCatalogRepository: IProductCatalogRepository,
  ) {}

  async execute(query: GetProductsByBulkRequestQuery): Promise<IProductWithMultimedia[]> {
    const { bulkRequestId, companyId, hasMultimediaOnly } = query;

    const products: IProductWithMultimedia[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const chunk = await this.productCatalogRepository.findByBulkRequestId(
        bulkRequestId,
        companyId,
        GetProductsByBulkRequestQueryHandler.CHUNK_SIZE,
        offset,
      );

      if (chunk.length === 0) {
        hasMore = false;
        break;
      }

      // Filter products with multimedia if requested
      const filteredChunk = hasMultimediaOnly
        ? chunk.filter(product => !product.isVisible) // Products with multimedia start as invisible
        : chunk;

      // Convert to interface format
      const convertedChunk: IProductWithMultimedia[] = filteredChunk.map(product => ({
        id: product.id.getValue(),
        sourceRowNumber: product.sourceRowNumber || 0,
        isVisible: product.isVisible,
        metadata: product.metadata,
      }));

      products.push(...convertedChunk);
      offset += GetProductsByBulkRequestQueryHandler.CHUNK_SIZE;

      // If we got less than chunk size, we've reached the end
      if (chunk.length < GetProductsByBulkRequestQueryHandler.CHUNK_SIZE) {
        hasMore = false;
      }
    }

    // Sort by sourceRowNumber ascending to maintain Excel order
    return products.sort((a, b) => a.sourceRowNumber - b.sourceRowNumber);
  }
}
