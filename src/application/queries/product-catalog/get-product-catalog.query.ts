import { IQuery, QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Injectable, Inject } from '@nestjs/common';
import { ForbiddenActionException } from '@core/exceptions/domain-exceptions';
import { ProductCatalogService } from '@core/services/product-catalog.service';
import { ProductMediaService } from '@core/services/product-media.service';
import { UserAuthorizationService } from '@core/services/user-authorization.service';
import { CompanyService } from '@core/services/company.service';
import { CompanyId } from '@core/value-objects/company-id.vo';
import { ProductCatalogMapper } from '@application/mappers/product-catalog.mapper';
import { ProductMediaMapper } from '@application/mappers/product-media.mapper';
import { IProductCatalogResponse } from '@application/dtos/_responses/product-catalog/product-catalog.response';
import { IFileRepository } from '@core/repositories/file.repository.interface';
import { FILE_REPOSITORY } from '@shared/constants/tokens';
import { EnhancedFileMapper } from '@application/mappers/enhanced-file.mapper';

export class GetProductCatalogQuery implements IQuery {
  constructor(
    public readonly id: string,
    public readonly companyId: string,
    public readonly userId: string,
  ) {}
}

@Injectable()
@QueryHandler(GetProductCatalogQuery)
export class GetProductCatalogQueryHandler implements IQueryHandler<GetProductCatalogQuery> {
  constructor(
    private readonly productCatalogService: ProductCatalogService,
    private readonly productMediaService: ProductMediaService,
    private readonly userAuthorizationService: UserAuthorizationService,
    private readonly companyService: CompanyService,
    @Inject(FILE_REPOSITORY)
    private readonly fileRepository: IFileRepository,
    private readonly enhancedFileMapper: EnhancedFileMapper,
  ) {}

  async execute(query: GetProductCatalogQuery): Promise<IProductCatalogResponse> {
    const { id, companyId, userId } = query;

    // Validate user and company access
    const user = await this.userAuthorizationService.getCurrentUserSafely(userId);
    if (!this.userAuthorizationService.canAccessCompany(user, companyId)) {
      throw new ForbiddenActionException('You can only access your assigned company resources');
    }

    const productCatalog = await this.productCatalogService.getProductCatalogById(id, companyId);

    // Fetch company information for currency and language
    const company = await this.companyService.getCompanyById(CompanyId.fromString(companyId));
    const companyCurrency = company.currency;
    const companyLanguage = company.language;

    // Fetch associated media with file information
    const productMediaList = await this.productMediaService.getProductMediaByProductId(
      id,
      companyId,
    );

    const mediaWithFiles = await Promise.all(
      productMediaList.map(async media => {
        const file = await this.fileRepository.findById(media.fileId.getValue());
        if (!file) {
          throw new ForbiddenActionException(`File not found: ${media.fileId.getValue()}`);
        }
        const fileResponse = await this.enhancedFileMapper.toResponseWithSignedUrl(file);

        return ProductMediaMapper.toResponse(media, fileResponse);
      }),
    );

    return ProductCatalogMapper.toResponse(
      productCatalog,
      mediaWithFiles,
      companyCurrency,
      companyLanguage,
    );
  }
}
