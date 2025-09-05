import { ICommand, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable, Inject } from '@nestjs/common';
import { ForbiddenActionException } from '@core/exceptions/domain-exceptions';
import { ProductMediaService } from '@core/services/product-media.service';
import { UserAuthorizationService } from '@core/services/user-authorization.service';
import { ProductMediaMapper } from '@application/mappers/product-media.mapper';
import { IProductMediaResponse } from '@application/dtos/_responses/product-media/product-media.response';
import { UpdateProductMediaDto } from '@application/dtos/product-media/update-product-media.dto';
import { IFileRepository } from '@core/repositories/file.repository.interface';
import { FILE_REPOSITORY } from '@shared/constants/tokens';
import { EnhancedFileMapper } from '@application/mappers/enhanced-file.mapper';

export class UpdateProductMediaCommand implements ICommand {
  constructor(
    public readonly id: string,
    public readonly dto: UpdateProductMediaDto,
    public readonly companyId: string,
    public readonly userId: string,
  ) {}
}

@Injectable()
@CommandHandler(UpdateProductMediaCommand)
export class UpdateProductMediaCommandHandler
  implements ICommandHandler<UpdateProductMediaCommand>
{
  constructor(
    private readonly productMediaService: ProductMediaService,
    private readonly userAuthorizationService: UserAuthorizationService,
    @Inject(FILE_REPOSITORY)
    private readonly fileRepository: IFileRepository,
    private readonly enhancedFileMapper: EnhancedFileMapper,
  ) {}

  async execute(command: UpdateProductMediaCommand): Promise<IProductMediaResponse> {
    const { id, dto, companyId, userId } = command;

    // Validate user and company access
    const user = await this.userAuthorizationService.getCurrentUserSafely(userId);
    if (!this.userAuthorizationService.canAccessCompany(user, companyId)) {
      throw new ForbiddenActionException('You can only access your assigned company resources');
    }

    const productMedia = await this.productMediaService.updateProductMedia(
      id,
      {
        fileName: dto.fileName,
        fav: dto.fav,
        description: dto.description,
        tags: dto.tags,
      },
      companyId,
      userId,
    );

    // Fetch file information
    const file = await this.fileRepository.findById(productMedia.fileId.getValue());
    if (!file) {
      throw new ForbiddenActionException('File not found');
    }

    const fileResponse = await this.enhancedFileMapper.toResponseWithSignedUrl(file);

    return ProductMediaMapper.toResponse(productMedia, fileResponse);
  }
}
