import { ICommand, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { ForbiddenActionException } from '@core/exceptions/domain-exceptions';
import { ProductCatalogService } from '@core/services/product-catalog.service';
import { UserAuthorizationService } from '@core/services/user-authorization.service';
import { ProductCatalogMapper } from '@application/mappers/product-catalog.mapper';
import { IProductCatalogResponse } from '@application/dtos/_responses/product-catalog/product-catalog.response';
import { CreateProductCatalogDto } from '@application/dtos/product-catalog/create-product-catalog.dto';

export class UpsertProductCatalogCommand implements ICommand {
  constructor(
    public readonly dto: CreateProductCatalogDto,
    public readonly companyId: string,
    public readonly userId: string,
  ) {}
}

@Injectable()
@CommandHandler(UpsertProductCatalogCommand)
export class UpsertProductCatalogCommandHandler
  implements ICommandHandler<UpsertProductCatalogCommand>
{
  constructor(
    private readonly productCatalogService: ProductCatalogService,
    private readonly userAuthorizationService: UserAuthorizationService,
  ) {}

  async execute(command: UpsertProductCatalogCommand): Promise<IProductCatalogResponse> {
    const { dto, companyId, userId } = command;

    // Validate user and company access
    const user = await this.userAuthorizationService.getCurrentUserSafely(userId);
    if (!this.userAuthorizationService.canAccessCompany(user, companyId)) {
      throw new ForbiddenActionException('You can only access your assigned company resources');
    }

    const productCatalog = await this.productCatalogService.upsertProductCatalog(
      {
        id: dto.id,
        industry: dto.industry,
        productService: dto.productService,
        type: dto.type,
        subcategory: dto.subcategory,
        listPrice: dto.listPrice,
        paymentOptions: dto.paymentOptions,
        description: dto.description,
        link: dto.link,
        sourceFileName: dto.sourceFileName,
        sourceRowNumber: dto.sourceRowNumber,
        langCode: dto.langCode,
      },
      companyId,
      userId,
    );

    return ProductCatalogMapper.toResponse(productCatalog, [], 'USD', 'en-US'); // Empty media array for new/updated catalog
  }
}
