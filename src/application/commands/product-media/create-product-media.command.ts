import { ICommand, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable, Inject } from '@nestjs/common';
import { ForbiddenActionException } from '@core/exceptions/domain-exceptions';
import { ProductMediaService } from '@core/services/product-media.service';
import { ProductCatalogService } from '@core/services/product-catalog.service';
import { UserAuthorizationService } from '@core/services/user-authorization.service';
import { ProductMediaMapper } from '@application/mappers/product-media.mapper';
import { IProductMediaResponse } from '@application/dtos/_responses/product-media/product-media.response';
import { CreateProductMediaDto } from '@application/dtos/product-media/create-product-media.dto';
import { IFileRepository } from '@core/repositories/file.repository.interface';
import { FILE_REPOSITORY } from '@shared/constants/tokens';
import { EnhancedFileMapper } from '@application/mappers/enhanced-file.mapper';

export class CreateProductMediaCommand implements ICommand {
  constructor(
    public readonly dto: CreateProductMediaDto,
    public readonly companyId: string,
    public readonly userId: string,
  ) {}
}

@Injectable()
@CommandHandler(CreateProductMediaCommand)
export class CreateProductMediaCommandHandler
  implements ICommandHandler<CreateProductMediaCommand>
{
  constructor(
    private readonly productMediaService: ProductMediaService,
    private readonly productCatalogService: ProductCatalogService,
    private readonly userAuthorizationService: UserAuthorizationService,
    @Inject(FILE_REPOSITORY)
    private readonly fileRepository: IFileRepository,
    private readonly enhancedFileMapper: EnhancedFileMapper,
  ) {}

  async execute(command: CreateProductMediaCommand): Promise<IProductMediaResponse> {
    const { dto, companyId, userId } = command;

    // Validate user and company access
    const user = await this.userAuthorizationService.getCurrentUserSafely(userId);
    if (!this.userAuthorizationService.canAccessCompany(user, companyId)) {
      throw new ForbiddenActionException('You can only access your assigned company resources');
    }

    // Verify user can access the product catalog
    await this.productCatalogService.getProductCatalogById(dto.productId, companyId);

    const productMedia = await this.productMediaService.createProductMedia({
      fileId: dto.fileId,
      fav: dto.fav || false,
      productId: dto.productId,
      companyId,
      createdBy: userId,
    });

    // Fetch file information
    const file = await this.fileRepository.findById(dto.fileId);
    if (!file) {
      throw new ForbiddenActionException('File not found');
    }

    const fileResponse = await this.enhancedFileMapper.toResponseWithSignedUrl(file);

    return ProductMediaMapper.toResponse(productMedia, fileResponse);
  }
}
