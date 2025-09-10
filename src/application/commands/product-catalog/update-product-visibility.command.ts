import { ICommand, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { ForbiddenActionException } from '@core/exceptions/domain-exceptions';
import { ProductCatalogService } from '@core/services/product-catalog.service';
import { UserAuthorizationService } from '@core/services/user-authorization.service';
import { ProductCatalogMapper } from '@application/mappers/product-catalog.mapper';
import { IProductCatalogResponse } from '@application/dtos/_responses/product-catalog/product-catalog.response';

export class UpdateProductVisibilityCommand implements ICommand {
  constructor(
    public readonly productId: string,
    public readonly isVisible: boolean,
    public readonly companyId: string,
    public readonly userId: string,
    public readonly forceOverwrite: boolean = false,
  ) {}
}

@Injectable()
@CommandHandler(UpdateProductVisibilityCommand)
export class UpdateProductVisibilityCommandHandler
  implements ICommandHandler<UpdateProductVisibilityCommand>
{
  constructor(
    private readonly productCatalogService: ProductCatalogService,
    private readonly userAuthorizationService: UserAuthorizationService,
  ) {}

  async execute(command: UpdateProductVisibilityCommand): Promise<IProductCatalogResponse> {
    const { productId, isVisible, companyId, userId, forceOverwrite } = command;

    // Validate user and company access
    const user = await this.userAuthorizationService.getCurrentUserSafely(userId);
    if (!this.userAuthorizationService.canAccessCompany(user, companyId)) {
      throw new ForbiddenActionException('You can only access your assigned company resources');
    }

    const productCatalog = await this.productCatalogService.updateProductVisibility(
      productId,
      companyId,
      isVisible,
      userId,
      forceOverwrite,
    );

    return ProductCatalogMapper.toResponse(productCatalog, [], 'USD', 'en-US'); // Empty media array for this operation
  }
}
