import { IQuery, QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Injectable, Inject } from '@nestjs/common';
import { ForbiddenActionException } from '@core/exceptions/domain-exceptions';
import { ProductMediaService } from '@core/services/product-media.service';
import { UserAuthorizationService } from '@core/services/user-authorization.service';
import { ProductMediaMapper } from '@application/mappers/product-media.mapper';
import { IProductMediaResponse } from '@application/dtos/_responses/product-media/product-media.response';
import { IFileRepository } from '@core/repositories/file.repository.interface';
import { FILE_REPOSITORY } from '@shared/constants/tokens';
import { EnhancedFileMapper } from '@application/mappers/enhanced-file.mapper';

export class GetProductMediaByProductQuery implements IQuery {
  constructor(
    public readonly productId: string,
    public readonly companyId: string,
    public readonly userId: string,
  ) {}
}

@Injectable()
@QueryHandler(GetProductMediaByProductQuery)
export class GetProductMediaByProductQueryHandler
  implements IQueryHandler<GetProductMediaByProductQuery>
{
  constructor(
    private readonly productMediaService: ProductMediaService,
    private readonly userAuthorizationService: UserAuthorizationService,
    @Inject(FILE_REPOSITORY)
    private readonly fileRepository: IFileRepository,
    private readonly enhancedFileMapper: EnhancedFileMapper,
  ) {}

  async execute(query: GetProductMediaByProductQuery): Promise<IProductMediaResponse[]> {
    const { productId, companyId, userId } = query;

    // Validate user and company access
    const user = await this.userAuthorizationService.getCurrentUserSafely(userId);
    if (!this.userAuthorizationService.canAccessCompany(user, companyId)) {
      throw new ForbiddenActionException('You can only access your assigned company resources');
    }

    const productMediaList = await this.productMediaService.getProductMediaByProductId(
      productId,
      companyId,
    );

    // Fetch file information for each media
    const mediaWithFiles = await Promise.all(
      productMediaList.map(async media => {
        const file = await this.fileRepository.findById(media.fileId.getValue());
        if (!file) {
          throw new ForbiddenActionException(`File not found: ${media.fileId.getValue()}`);
        }
        const fileResponse = await this.enhancedFileMapper.toResponseWithSignedUrl(file);

        return { media, file: fileResponse };
      }),
    );

    return ProductMediaMapper.toResponseList(mediaWithFiles);
  }
}
