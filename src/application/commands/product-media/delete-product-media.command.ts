import { ICommand, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { ForbiddenActionException } from '@core/exceptions/domain-exceptions';
import { ProductMediaService } from '@core/services/product-media.service';
import { UserAuthorizationService } from '@core/services/user-authorization.service';

export class DeleteProductMediaCommand implements ICommand {
  constructor(
    public readonly id: string,
    public readonly companyId: string,
    public readonly userId: string,
  ) {}
}

@Injectable()
@CommandHandler(DeleteProductMediaCommand)
export class DeleteProductMediaCommandHandler
  implements ICommandHandler<DeleteProductMediaCommand>
{
  constructor(
    private readonly productMediaService: ProductMediaService,
    private readonly userAuthorizationService: UserAuthorizationService,
  ) {}

  async execute(command: DeleteProductMediaCommand): Promise<void> {
    const { id, companyId, userId } = command;

    // Validate user and company access
    const user = await this.userAuthorizationService.getCurrentUserSafely(userId);
    if (!this.userAuthorizationService.canAccessCompany(user, companyId)) {
      throw new ForbiddenActionException('You can only access your assigned company resources');
    }

    await this.productMediaService.deleteProductMedia(id, companyId, userId);
  }
}
