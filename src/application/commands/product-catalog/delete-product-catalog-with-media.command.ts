import { ICommand, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable, Inject } from '@nestjs/common';
import { ForbiddenActionException } from '@core/exceptions/domain-exceptions';
import { ProductCatalogService } from '@core/services/product-catalog.service';
import { ProductMediaService } from '@core/services/product-media.service';
import { UserAuthorizationService } from '@core/services/user-authorization.service';
import { ILogger } from '@core/interfaces/logger.interface';
import { LOGGER_SERVICE } from '@shared/constants/tokens';

export class DeleteProductCatalogWithMediaCommand implements ICommand {
  constructor(
    public readonly id: string,
    public readonly companyId: string,
    public readonly userId: string,
  ) {}
}

@Injectable()
@CommandHandler(DeleteProductCatalogWithMediaCommand)
export class DeleteProductCatalogWithMediaCommandHandler
  implements ICommandHandler<DeleteProductCatalogWithMediaCommand>
{
  constructor(
    private readonly productCatalogService: ProductCatalogService,
    private readonly productMediaService: ProductMediaService,
    private readonly userAuthorizationService: UserAuthorizationService,
    @Inject(LOGGER_SERVICE)
    private readonly logger: ILogger,
  ) {
    this.logger.setContext(DeleteProductCatalogWithMediaCommandHandler.name);
  }

  async execute(command: DeleteProductCatalogWithMediaCommand): Promise<void> {
    const { id, companyId, userId } = command;

    // Validate user and company access
    const user = await this.userAuthorizationService.getCurrentUserSafely(userId);
    if (!this.userAuthorizationService.canAccessCompany(user, companyId)) {
      throw new ForbiddenActionException('You can only access your assigned company resources');
    }

    // 1. First get all media for this product
    const productMediaList = await this.productMediaService.getProductMediaByProductId(
      id,
      companyId,
    );

    // 2. Delete each media file from storage (NOT in transaction as requested)
    for (const productMedia of productMediaList) {
      // Then delete the media record
      // Do not execute in transaction
      await this.productMediaService.deleteProductMedia(
        productMedia.id.getValue(),
        companyId,
        userId,
      );
    }

    // 3. Finally delete the product catalog
    await this.productCatalogService.deleteProductCatalog(id, companyId, userId);
  }
}
