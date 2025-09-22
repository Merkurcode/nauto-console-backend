import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ProductCatalogController } from './product-catalog.controller';
import { ProductMediaController } from './product-media.controller';
import { ProductCatalogService } from '@core/services/product-catalog.service';
import { ProductMediaService } from '@core/services/product-media.service';
import { ProductCatalogRepository } from '@infrastructure/repositories/product-catalog.repository';
import { ProductMediaRepository } from '@infrastructure/repositories/product-media.repository';
import { BulkProcessingRequestRepository } from '@infrastructure/repositories/bulk-processing-request.repository';
import { PrismaModule } from '@infrastructure/database/prisma/prisma.module';
import { StorageModule } from '@infrastructure/storage/storage.module';
import { CoreModule } from '@core/core.module';
import { InfrastructureModule } from '@infrastructure/infrastructure.module';
import {
  PRODUCT_CATALOG_REPOSITORY,
  PRODUCT_MEDIA_REPOSITORY,
  BULK_PROCESSING_REQUEST_REPOSITORY,
} from '@shared/constants/tokens';
import { EnhancedFileMapper } from '@application/mappers/enhanced-file.mapper';

// Command handlers
import { UpsertProductCatalogCommandHandler } from '@application/commands/product-catalog/upsert-product-catalog.command';
import { UpdateProductCatalogCommandHandler } from '@application/commands/product-catalog/update-product-catalog.command';
import { UpdateProductVisibilityCommandHandler } from '@application/commands/product-catalog/update-product-visibility.command';
import { ToggleProductVisibilityCommandHandler } from '@application/commands/product-catalog/toggle-product-visibility.command';
import { DeleteProductCatalogWithMediaCommandHandler } from '@application/commands/product-catalog/delete-product-catalog-with-media.command';

// ProductMedia Command handlers
import { CreateProductMediaCommandHandler } from '@application/commands/product-media/create-product-media.command';
import { UpdateProductMediaCommandHandler } from '@application/commands/product-media/update-product-media.command';
import { DeleteProductMediaCommandHandler } from '@application/commands/product-media/delete-product-media.command';

// Query handlers
import { GetProductCatalogQueryHandler } from '@application/queries/product-catalog/get-product-catalog.query';
import { GetProductCatalogsByCompanyQueryHandler } from '@application/queries/product-catalog/get-product-catalogs-by-company.query';
import { GetProductsByBulkRequestQueryHandler } from '@application/queries/product-catalog/get-products-by-bulk-request.query';
import { SearchProductsQueryHandler } from '@application/queries/product-catalog/search-products.query';

// ProductMedia Query handlers
import { GetProductMediaByProductQueryHandler } from '@application/queries/product-media/get-product-media-by-product.query';

const CommandHandlers = [
  UpsertProductCatalogCommandHandler,
  UpdateProductCatalogCommandHandler,
  UpdateProductVisibilityCommandHandler,
  ToggleProductVisibilityCommandHandler,
  DeleteProductCatalogWithMediaCommandHandler,
  CreateProductMediaCommandHandler,
  UpdateProductMediaCommandHandler,
  DeleteProductMediaCommandHandler,
];

const QueryHandlers = [
  GetProductCatalogQueryHandler,
  GetProductCatalogsByCompanyQueryHandler,
  GetProductsByBulkRequestQueryHandler,
  SearchProductsQueryHandler,
  GetProductMediaByProductQueryHandler,
];

@Module({
  imports: [CqrsModule, PrismaModule, StorageModule, CoreModule, InfrastructureModule],
  controllers: [ProductCatalogController, ProductMediaController],
  providers: [
    ProductCatalogService,
    ProductMediaService,
    EnhancedFileMapper,
    {
      provide: PRODUCT_CATALOG_REPOSITORY,
      useClass: ProductCatalogRepository,
    },
    {
      provide: PRODUCT_MEDIA_REPOSITORY,
      useClass: ProductMediaRepository,
    },
    {
      provide: BULK_PROCESSING_REQUEST_REPOSITORY,
      useClass: BulkProcessingRequestRepository,
    },
    ...CommandHandlers,
    ...QueryHandlers,
  ],
  exports: [ProductCatalogService, ProductMediaService],
})
export class ProductCatalogModule {}
