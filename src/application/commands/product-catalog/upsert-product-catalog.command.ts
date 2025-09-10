import { ICommand, CommandHandler, ICommandHandler, QueryBus } from '@nestjs/cqrs';
import { Injectable, Inject } from '@nestjs/common';
import {
  EntityNotFoundException,
  ForbiddenActionException,
} from '@core/exceptions/domain-exceptions';
import { ProductCatalogService } from '@core/services/product-catalog.service';
import { UserAuthorizationService } from '@core/services/user-authorization.service';
import { ProductCatalogMapper } from '@application/mappers/product-catalog.mapper';
import { IProductCatalogResponse } from '@application/dtos/_responses/product-catalog/product-catalog.response';
import { CreateProductCatalogDto } from '@application/dtos/product-catalog/create-product-catalog.dto';
import { CompanyService } from '@core/services/company.service';
import { CompanyId } from '@core/value-objects/company-id.vo';
import { GetProductMediaByProductQuery } from '@application/queries/product-media/get-product-media-by-product.query';
import { IBulkProcessingRequestRepository } from '@core/repositories/bulk-processing-request.repository.interface';
import { UnauthorizedBulkProcessingRequestAccessException } from '@core/exceptions/bulk-processing.exceptions';
import { BULK_PROCESSING_REQUEST_REPOSITORY } from '@shared/constants/tokens';

export class UpsertProductCatalogCommand implements ICommand {
  constructor(
    public readonly dto: CreateProductCatalogDto,
    public readonly companyId: string,
    public readonly userId: string,
    public readonly isVisible?: boolean,
    public readonly includeMedia?: boolean,
    public readonly comesFromBulkProcessing?: boolean,
  ) {}
}

@Injectable()
@CommandHandler(UpsertProductCatalogCommand)
export class UpsertProductCatalogCommandHandler
  implements ICommandHandler<UpsertProductCatalogCommand>
{
  constructor(
    private readonly productCatalogService: ProductCatalogService,
    private readonly userAuthorizationService: UserAuthorizationService,
    private readonly companyService: CompanyService,
    @Inject(BULK_PROCESSING_REQUEST_REPOSITORY)
    private readonly bulkProcessingRequestRepository: IBulkProcessingRequestRepository,
    private readonly queryBus: QueryBus,
  ) {}

  async execute(command: UpsertProductCatalogCommand): Promise<IProductCatalogResponse> {
    const { dto, companyId, userId, isVisible, includeMedia, comesFromBulkProcessing } = command;

    // Validate user and company access
    const user = await this.userAuthorizationService.getCurrentUserSafely(userId);
    if (!this.userAuthorizationService.canAccessCompany(user, companyId)) {
      throw new ForbiddenActionException('You can only access your assigned company resources');
    }

    let company;

    if (!comesFromBulkProcessing) {
      // Validate that company exists
      company = await this.companyService.getCompanyById(CompanyId.fromString(companyId));
      if (!company) {
        throw new EntityNotFoundException('Company', companyId);
      }
    }

    if (!comesFromBulkProcessing) {
      const product = await this.productCatalogService.getProductCatalogById(dto.id, companyId);
      if (product && product.bulkRequestId) {
        const bulkProcessing = await this.bulkProcessingRequestRepository.findByIdAndCompany(
          product.bulkRequestId,
          companyId,
        );
        if (bulkProcessing) {
          if (bulkProcessing.isInProgress() && isVisible !== undefined && isVisible !== null) {
            throw new UnauthorizedBulkProcessingRequestAccessException(
              bulkProcessing.id.toString(),
              companyId,
            );
          }
        }
      }
    }

    const productCatalog = await this.productCatalogService.upsertProductCatalog(
      {
        id: dto.id,
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
        bulkRequestId: dto.bulkRequestId,
        isVisible: isVisible,
        metadata: dto.metadata,
        ignoreIsVisibleIfExists: false,
      },
      companyId,
      userId,
    );

    // Get existing media for the product only if requested
    let existingMedia = [];
    if (includeMedia && dto.id) {
      try {
        existingMedia = await this.queryBus.execute(
          new GetProductMediaByProductQuery(productCatalog.id.getValue(), companyId, userId),
        );
      } catch (_error) {
        // If product doesn't exist yet or no media found, use empty array
        existingMedia = [];
      }
    }

    return ProductCatalogMapper.toResponse(
      productCatalog,
      existingMedia,
      comesFromBulkProcessing ? 'USD' : company.currency,
      comesFromBulkProcessing ? 'en-US' : company.language,
    );
  }
}
