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

export class GetProductCatalogsByCompanyQuery implements IQuery {
  constructor(
    public readonly companyId: string,
    public readonly userId: string,
    public readonly filters?: {
      industry?: string;
      type?: string;
      subcategory?: string;
      visible?: boolean;
    },
  ) {}
}

@Injectable()
@QueryHandler(GetProductCatalogsByCompanyQuery)
export class GetProductCatalogsByCompanyQueryHandler
  implements IQueryHandler<GetProductCatalogsByCompanyQuery>
{
  constructor(
    private readonly productCatalogService: ProductCatalogService,
    private readonly productMediaService: ProductMediaService,
    private readonly userAuthorizationService: UserAuthorizationService,
    private readonly companyService: CompanyService,
    @Inject(FILE_REPOSITORY)
    private readonly fileRepository: IFileRepository,
    private readonly enhancedFileMapper: EnhancedFileMapper,
  ) {}

  async execute(query: GetProductCatalogsByCompanyQuery): Promise<IProductCatalogResponse[]> {
    const { companyId, userId, filters } = query;

    // Validate user and company access
    const user = await this.userAuthorizationService.getCurrentUserSafely(userId);
    if (!this.userAuthorizationService.canAccessCompany(user, companyId)) {
      throw new ForbiddenActionException('You can only access your assigned company resources');
    }

    let productCatalogs;

    if (filters?.industry) {
      productCatalogs = await this.productCatalogService.getProductCatalogsByIndustry(
        filters.industry,
        companyId,
      );
    } else if (filters?.type) {
      productCatalogs = await this.productCatalogService.getProductCatalogsByType(
        filters.type,
        companyId,
      );
    } else if (filters?.subcategory) {
      productCatalogs = await this.productCatalogService.getProductCatalogsBySubcategory(
        filters.subcategory,
        companyId,
      );
    } else {
      productCatalogs = await this.productCatalogService.getProductCatalogsByCompany(companyId);
    }

    // Apply visibility filter if specified
    if (filters?.visible !== undefined) {
      productCatalogs = productCatalogs.filter(catalog => catalog.isVisible === filters.visible);
    }

    // Fetch company information for currency and language
    const company = await this.companyService.getCompanyById(CompanyId.fromString(companyId));
    const companyCurrency = company.currency;
    const companyLanguage = company.language;

    // Fetch media with file information for each catalog
    const catalogsWithMedia = await Promise.all(
      productCatalogs.map(async catalog => {
        const productMediaList = await this.productMediaService.getProductMediaByProductId(
          catalog.id.getValue(),
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

        return {
          catalog,
          media: mediaWithFiles,
          currency: companyCurrency,
          language: companyLanguage,
        };
      }),
    );

    return ProductCatalogMapper.toResponseList(catalogsWithMedia);
  }
}
