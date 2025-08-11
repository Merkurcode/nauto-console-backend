import { Module, DynamicModule, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageService } from '@core/services/storage.service';
import { MinioStorageProvider } from './providers/minio.provider';
import { S3StorageProvider } from './providers/s3.provider';
import { FileRepository } from '../repositories/file.repository';
import { PrismaService } from '../database/prisma/prisma.service';
import { TransactionContextService } from '../database/prisma/transaction-context.service';
import { MulterModule } from '@nestjs/platform-express';
import { FILE_REPOSITORY } from '@shared/constants/tokens';
import { CoreModule } from '@core/core.module';

@Module({
  imports: [
    MulterModule.register({
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
    }),
    forwardRef(() => CoreModule),
  ],
  providers: [
    {
      provide: FILE_REPOSITORY,
      useFactory: (prisma: PrismaService, transactionContext: TransactionContextService) =>
        new FileRepository(prisma, transactionContext),
      inject: [PrismaService, TransactionContextService],
    },
    StorageService,
    MinioStorageProvider,
    S3StorageProvider,
    {
      provide: 'STORAGE_PROVIDER',
      useFactory: (
        configService: ConfigService,
        minioProvider: MinioStorageProvider,
        s3Provider: S3StorageProvider,
      ) => {
        const driver = configService.get<string>('storage.provider');

        if (driver === 's3') {
          return s3Provider;
        }

        // Default to MinIO provider
        return minioProvider;
      },
      inject: [ConfigService, MinioStorageProvider, S3StorageProvider],
    },
    {
      provide: 'STORAGE_SERVICE_INITIALIZATION',
      useFactory: (storageService: StorageService, storageProvider) => {
        storageService.setProvider(storageProvider);

        return true;
      },
      inject: [StorageService, 'STORAGE_PROVIDER'],
    },
  ],
  exports: [StorageService],
})
export class StorageModule {
  static register(options?: { global?: boolean }): DynamicModule {
    return {
      module: StorageModule,
      global: options?.global || false,
    };
  }
}
