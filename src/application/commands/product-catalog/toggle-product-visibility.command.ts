import { CommandHandler, ICommand, ICommandHandler } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { ProductCatalogService } from '@core/services/product-catalog.service';
import { UserAuthorizationService } from '@core/services/user-authorization.service';
import { ForbiddenActionException } from '@core/exceptions/domain-exceptions';
import { ProductCatalogMapper } from '@application/mappers/product-catalog.mapper';
import { IProductCatalogResponse } from '@application/dtos/_responses/product-catalog/product-catalog.response';

export class ToggleProductVisibilityCommand implements ICommand {
  constructor(
    public readonly productId: string,
    public readonly companyId: string,
    public readonly userId: string,
    public readonly visible?: boolean, // If not specified, it will toggle
  ) {}
}

@Injectable()
@CommandHandler(ToggleProductVisibilityCommand)
export class ToggleProductVisibilityCommandHandler
  implements ICommandHandler<ToggleProductVisibilityCommand>
{
  constructor(
    private readonly productCatalogService: ProductCatalogService,
    private readonly userAuthorizationService: UserAuthorizationService,
  ) {}

  async execute(command: ToggleProductVisibilityCommand): Promise<IProductCatalogResponse> {
    const { productId, companyId, userId, visible } = command;

    // Validate user and company access
    const user = await this.userAuthorizationService.getCurrentUserSafely(userId);
    if (!this.userAuthorizationService.canAccessCompany(user, companyId)) {
      throw new ForbiddenActionException('You can only access your assigned company resources');
    }

    // Get the product
    const product = await this.productCatalogService.getProductCatalogById(productId, companyId);
    if (!product) {
      throw new ForbiddenActionException(`Product not found: ${productId}`);
    }

    // Toggle or set visibility
    const newVisibility = visible !== undefined ? visible : !product.isVisible;

    // Update the product visibility
    const updatedProduct = await this.productCatalogService.updateProductVisibility(
      productId,
      companyId,
      newVisibility,
      userId,
      true,
    );

    return ProductCatalogMapper.toResponse(updatedProduct, [], 'USD', 'en-US');
  }
}
