import { IQuery, IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Injectable, Inject } from '@nestjs/common';
import { ISearchProductsResponse } from '@application/dtos/_responses/product-catalog/product-catalog.response';
import { IProductCatalogRepository } from '@core/repositories/product-catalog.repository.interface';
import { PRODUCT_CATALOG_REPOSITORY } from '@shared/constants/tokens';
import { PaymentOption } from '@prisma/client';
import { UserAuthorizationService } from '@core/services/user-authorization.service';
import { ForbiddenActionException } from '@core/exceptions/domain-exceptions';
import { IJwtPayload } from '@application/dtos/_responses/user/user.response';

export class SearchProductsQuery implements IQuery {
  constructor(
    public readonly companyId: string,
    public readonly query?: string,
    public readonly limit: number = 20,
    public readonly offset: number = 0,
    public readonly onlyVisible: boolean = true,
    public readonly minPrice?: number,
    public readonly maxPrice?: number,
    public readonly type?: string,
    public readonly subcategory?: string,
    public readonly paymentOptions?: PaymentOption[],
    public readonly user?: IJwtPayload,
  ) {}
}

@Injectable()
@QueryHandler(SearchProductsQuery)
export class SearchProductsQueryHandler implements IQueryHandler<SearchProductsQuery> {
  constructor(
    @Inject(PRODUCT_CATALOG_REPOSITORY)
    private readonly productCatalogRepository: IProductCatalogRepository,
    private readonly userAuthorizationService: UserAuthorizationService,
  ) {}

  async execute(query: SearchProductsQuery): Promise<ISearchProductsResponse> {
    const {
      companyId,
      query: searchQuery,
      limit,
      offset,
      onlyVisible,
      minPrice,
      maxPrice,
      type,
      subcategory,
      paymentOptions,
      user,
    } = query;

    // Validate user and company access
    if (!this.userAuthorizationService.canAccessCompany(user, companyId)) {
      throw new ForbiddenActionException('You can only access your assigned company resources');
    }

    const result = await this.productCatalogRepository.searchProducts({
      companyId,
      query: searchQuery,
      limit,
      offset,
      onlyVisible,
      minPrice,
      maxPrice,
      type,
      subcategory,
      paymentOptions,
    });

    return {
      products: result.products,
      totalCount: result.totalCount,
      limit,
      offset,
      hasMore: result.hasMore, //offset + limit < result.totalCount,
    };
  }
}
