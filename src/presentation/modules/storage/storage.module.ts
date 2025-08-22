import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

// Controllers
import { StorageController } from './storage.controller';
import { PublicStorageController } from './public-storage.controller';

// Core services and modules
import { CoreModule } from '@core/core.module';
import { InfrastructureModule } from '@infrastructure/infrastructure.module';
import { StorageModule as InfraStorageModule } from '@infrastructure/storage/storage.module';

// Command Handlers
import { InitiateMultipartUploadHandler } from '@application/commands/storage/initiate-multipart-upload.command';
import { GeneratePartUrlHandler } from '@application/commands/storage/generate-part-url.command';
import { CompleteMultipartUploadHandler } from '@application/commands/storage/complete-multipart-upload.command';
import { AbortMultipartUploadHandler } from '@application/commands/storage/abort-multipart-upload.command';
import { MoveFileHandler } from '@application/commands/storage/move-file.command';
import { RenameFileHandler } from '@application/commands/storage/rename-file.command';
import { DeleteFileHandler } from '@application/commands/storage/delete-file.command';
import { SetFileVisibilityHandler } from '@application/commands/storage/set-file-visibility.command';
import { ClearUserConcurrencySlotsHandler } from '@application/commands/storage/clear-user-concurrency-slots.command';
import { HeartbeatUploadHandler } from '@application/commands/storage/heartbeat-upload.command';

// Query Handlers
import { GetUploadStatusHandler } from '@application/queries/storage/get-upload-status.query';
import { GetFileHandler } from '@application/queries/storage/get-file.query';
import { GetUserFilesHandler } from '@application/queries/storage/get-user-files.query';
import { GetFileSignedUrlHandler } from '@application/queries/storage/get-file-signed-url.query';
import { GetUserStorageQuotaHandler } from '@application/queries/storage/get-user-storage-quota.query';
import { GetConcurrencyStatsHandler } from '@application/queries/storage/get-concurrency-stats.query';
import { GetUserConcurrentCountHandler } from '@application/queries/storage/get-user-concurrent-count.query';
import { GetConcurrencyHealthHandler } from '@application/queries/storage/get-concurrency-health.query';
import { GetPublicFileSignedUrlHandler } from '@application/queries/storage/get-public-file-signed-url.query';

const commandHandlers = [
  InitiateMultipartUploadHandler,
  GeneratePartUrlHandler,
  CompleteMultipartUploadHandler,
  AbortMultipartUploadHandler,
  MoveFileHandler,
  RenameFileHandler,
  DeleteFileHandler,
  SetFileVisibilityHandler,
  ClearUserConcurrencySlotsHandler,
  HeartbeatUploadHandler,
];

const queryHandlers = [
  GetUploadStatusHandler,
  GetFileHandler,
  GetUserFilesHandler,
  GetFileSignedUrlHandler,
  GetUserStorageQuotaHandler,
  GetConcurrencyStatsHandler,
  GetUserConcurrentCountHandler,
  GetConcurrencyHealthHandler,
  GetPublicFileSignedUrlHandler,
];

@Module({
  imports: [CqrsModule, CoreModule, InfrastructureModule, InfraStorageModule],
  controllers: [StorageController, PublicStorageController],
  providers: [
    // Command handlers
    ...commandHandlers,

    // Query handlers
    ...queryHandlers,
  ],
  exports: [],
})
export class StorageModule {}
