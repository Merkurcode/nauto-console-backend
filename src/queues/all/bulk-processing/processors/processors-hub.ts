import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ConfigService } from '@nestjs/config';
import { ILogger } from '@core/interfaces/logger.interface';
import { IFileRepository } from '@core/repositories/file.repository.interface';
import { IBulkProcessingRequestRepository } from '@core/repositories/bulk-processing-request.repository.interface';
import { IProductCatalogRepository } from '@core/repositories/product-catalog.repository.interface';
import { BulkProcessingRequest } from '@core/entities/bulk-processing-request.entity';
import { FileDownloadStreamingService } from '@core/services/file-download-streaming.service';
import { UserStorageConfigService } from '@core/services/user-storage-config.service';
import { BulkProcessingEventType } from '@shared/constants/bulk-processing-type.enum';
import { ProductCatalogRowProcessor } from '@queues/all/bulk-processing/processors/product-catalog.processor';
import { IBulkProcessingContext } from '@core/services/bulk-processing.service';
import { IExcelRowProcessor } from '@core/services/excel-streaming.service';
import { UserStorageConfig } from '@core/entities/user-storage-config.entity';
import { IStorageService } from '@core/repositories/storage.service.interface';
import { BulkProcessingEventBus } from '../bulk-processing-event-bus';

/** Firma del constructor de cada Processor */
type ProcessorCtor = new (
  commandBus: CommandBus,
  queryBus: QueryBus,
  fileDownloadService: FileDownloadStreamingService,
  logger: ILogger,
  context: IBulkProcessingContext,
  bulkRequest: BulkProcessingRequest,
  bulkProcessingRequestRepository: IBulkProcessingRequestRepository,
  configService: ConfigService,
  fileRepository: IFileRepository,
  productCatalogRepository: IProductCatalogRepository,
  allowedExtensions: string[] | null,
  userStorageConfig: UserStorageConfig,
  storageService: IStorageService,
  bulkProcessingEventBus: BulkProcessingEventBus,
) => IExcelRowProcessor;

export class ProcessorHub {
  /** Mapa de tipo-de-evento -> Constructor del Processor */
  private static readonly PROCESSORS = new Map<BulkProcessingEventType, ProcessorCtor>([
    [BulkProcessingEventType.PRODUCT_CATALOG_BULK_IMPORT, ProductCatalogRowProcessor],
    // agrega más aquí: [BulkProcessingEventType.USER_BULK_IMPORT, UserRowProcessor],
  ]);

  public static async createProcessorForEventType(
    fileRepository: IFileRepository,
    bulkProcessingRequestRepository: IBulkProcessingRequestRepository,
    fileDownloadService: FileDownloadStreamingService,
    commandBus: CommandBus,
    queryBus: QueryBus,
    configService: ConfigService,
    userStorageConfigService: UserStorageConfigService,
    logger: ILogger,
    eventType: BulkProcessingEventType,
    context: IBulkProcessingContext,
    bulkRequest: BulkProcessingRequest,
    storageService: IStorageService,
    productCatalogRepository: IProductCatalogRepository,
    bulkProcessingEventBus: BulkProcessingEventBus,
  ): Promise<IExcelRowProcessor> {
    const userStorageConfig = await userStorageConfigService.getUserStorageConfigByUserId(
      context.userId,
    );

    const allowedExtensions = await this.getUserAllowedFileExtensions(
      userStorageConfig,
      logger,
      context.userId,
    );

    const Ctor = this.PROCESSORS.get(eventType);
    if (!Ctor) {
      throw new Error(`Unsupported event type: ${eventType}`);
    }

    return new Ctor(
      commandBus,
      queryBus,
      fileDownloadService,
      logger,
      context,
      bulkRequest,
      bulkProcessingRequestRepository,
      configService,
      fileRepository,
      productCatalogRepository,
      allowedExtensions,
      userStorageConfig,
      storageService,
      bulkProcessingEventBus,
    );
  }

  private static async getUserAllowedFileExtensions(
    userStorageConfig: UserStorageConfig,
    logger: ILogger,
    userId: string,
  ): Promise<string[] | null> {
    try {
      if (!userStorageConfig || !userStorageConfig.allowedFileConfig) {
        return null; // devuelve null para que el Processor aplique sus defaults si corresponde
      }
      const allowed: string[] = [];
      Object.keys(userStorageConfig.allowedFileConfig).forEach(ext => {
        allowed.push(ext.startsWith('.') ? ext : `.${ext}`);
      });

      return allowed;
    } catch (e) {
      logger.warn(`Using default allowed extensions for ${userId}: ${e}`);

      return null;
    }
  }
}
