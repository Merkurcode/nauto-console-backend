import { IQuery, QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Injectable, Inject } from '@nestjs/common';
import { IProductCatalogRepository } from '@core/repositories/product-catalog.repository.interface';
import { PRODUCT_CATALOG_REPOSITORY } from '@shared/constants/tokens';

export class CheckProductExistsQuery implements IQuery {
  constructor(
    public readonly productId: string,
    public readonly companyId: string,
  ) {}
}

export interface ICheckProductExistsResponse {
  exists: boolean;
  isVisible?: boolean;
}

@Injectable()
@QueryHandler(CheckProductExistsQuery)
export class CheckProductExistsQueryHandler implements IQueryHandler<CheckProductExistsQuery> {
  constructor(
    @Inject(PRODUCT_CATALOG_REPOSITORY)
    private readonly productCatalogRepository: IProductCatalogRepository,
  ) {}

  async execute(query: CheckProductExistsQuery): Promise<ICheckProductExistsResponse> {
    const { productId, companyId } = query;

    const product = await this.productCatalogRepository.findById(productId, companyId);

    return {
      exists: !!product,
      isVisible: product?.isVisible,
    };
  }
}
