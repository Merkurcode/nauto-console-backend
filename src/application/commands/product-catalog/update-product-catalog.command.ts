import { ICommand, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { ForbiddenActionException } from '@core/exceptions/domain-exceptions';
import { ProductCatalogService } from '@core/services/product-catalog.service';
import { UserAuthorizationService } from '@core/services/user-authorization.service';
import { ProductCatalogMapper } from '@application/mappers/product-catalog.mapper';
import { IProductCatalogResponse } from '@application/dtos/_responses/product-catalog/product-catalog.response';
import { UpdateProductCatalogDto } from '@application/dtos/product-catalog/update-product-catalog.dto';

export class UpdateProductCatalogCommand implements ICommand {
  constructor(
    public readonly id: string,
    public readonly dto: UpdateProductCatalogDto,
    public readonly companyId: string,
    public readonly userId: string,
  ) {}
}

@Injectable()
@CommandHandler(UpdateProductCatalogCommand)
export class UpdateProductCatalogCommandHandler
  implements ICommandHandler<UpdateProductCatalogCommand>
{
  constructor(
    private readonly productCatalogService: ProductCatalogService,
    private readonly userAuthorizationService: UserAuthorizationService,
  ) {}

  async execute(command: UpdateProductCatalogCommand): Promise<IProductCatalogResponse> {
    const { id, dto, companyId, userId } = command;

    // Validate user and company access
    const user = await this.userAuthorizationService.getCurrentUserSafely(userId);
    if (!this.userAuthorizationService.canAccessCompany(user, companyId)) {
      throw new ForbiddenActionException('You can only access your assigned company resources');
    }

    const productCatalog = await this.productCatalogService.updateProductCatalog(
      id,
      {
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

    return ProductCatalogMapper.toResponse(productCatalog, [], 'USD', 'en-US'); // Empty media array for updated catalog
  }
}
