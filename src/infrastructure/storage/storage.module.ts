import { Module, DynamicModule, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import { FileOperationsService } from '@core/services/file-operations.service';
import { MultipartUploadService } from '@core/services/multipart-upload.service';
import { StorageProviderFactory } from './storage-provider.factory';
import { FileRepository } from '../repositories/file.repository';
import { UserStorageConfigRepository } from '../repositories/user-storage-config.repository';
import { PrismaService } from '../database/prisma/prisma.service';
import { TransactionContextService } from '../database/prisma/transaction-context.service';
import { RequestCacheService } from '../caching/request-cache.service';
import { RedisModule } from '../redis/redis.module';
import { ConcurrencyService } from '../services/concurrency.service';
import {
  FILE_REPOSITORY,
  STORAGE_SERVICE,
  LOGGER_SERVICE,
  USER_STORAGE_CONFIG_REPOSITORY,
  CONCURRENCY_SERVICE,
} from '@shared/constants/tokens';
import { CoreModule } from '@core/core.module';
import { ILogger } from '@core/interfaces/logger.interface';

@Module({
  imports: [CqrsModule, RedisModule, forwardRef(() => CoreModule)],
  providers: [
    RequestCacheService,
    {
      provide: FILE_REPOSITORY,
      useFactory: (
        prisma: PrismaService,
        transactionContext: TransactionContextService,
        configService: ConfigService,
        logger: ILogger,
        requestCache: RequestCacheService,
      ) => new FileRepository(prisma, transactionContext, configService, logger, requestCache),
      inject: [
        PrismaService,
        TransactionContextService,
        ConfigService,
        LOGGER_SERVICE,
        RequestCacheService,
      ],
    },
    {
      provide: USER_STORAGE_CONFIG_REPOSITORY,
      useFactory: (
        prisma: PrismaService,
        transactionContext: TransactionContextService,
        logger: ILogger,
        requestCache: RequestCacheService,
      ) => new UserStorageConfigRepository(prisma, transactionContext, logger, requestCache),
      inject: [PrismaService, TransactionContextService, LOGGER_SERVICE, RequestCacheService],
    },
    {
      provide: STORAGE_SERVICE,
      useFactory: (configService: ConfigService, logger: ILogger) => {
        // Validate configuration before creating the provider
        const validation = StorageProviderFactory.validateConfig(configService);

        if (!validation.isValid) {
          logger.error({
            message: 'Storage provider configuration validation failed',
            provider: validation.provider,
            errors: validation.errors,
            context: 'StorageModule',
          });
          throw new Error(`Storage configuration errors: ${validation.errors.join(', ')}`);
        }

        if (validation.warnings.length > 0) {
          logger.warn({
            message: 'Storage provider configuration warnings',
            provider: validation.provider,
            warnings: validation.warnings,
            context: 'StorageModule',
          });
        }

        // Log provider information
        const providerInfo = StorageProviderFactory.getProviderInfo(configService);
        logger.log({
          message: 'Storage provider initialized',
          ...providerInfo,
          context: 'StorageModule',
        });

        return StorageProviderFactory.create(configService, logger);
      },
      inject: [ConfigService, LOGGER_SERVICE],
    },
    {
      provide: CONCURRENCY_SERVICE,
      useClass: ConcurrencyService,
    },
    FileOperationsService,
    MultipartUploadService,
    // Storage services for multipart upload system
    // Provider is selected dynamically based on STORAGE_DRIVER environment variable:
    // - 'minio': MinIO storage service (default for development)
    // - 'aws': AWS S3 storage service (recommended for production)
  ],
  exports: [
    FileOperationsService,
    MultipartUploadService,
    FILE_REPOSITORY,
    STORAGE_SERVICE,
    USER_STORAGE_CONFIG_REPOSITORY,
    CONCURRENCY_SERVICE,
  ],
})
export class StorageModule {
  static register(options?: { global?: boolean }): DynamicModule {
    return {
      module: StorageModule,
      global: options?.global || false,
    };
  }
}
