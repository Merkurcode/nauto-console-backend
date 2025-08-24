import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

// Controllers
import { StorageController } from './storage.controller';
import { PublicStorageController } from './public-storage.controller';
import { StorageCommonController } from './storage-common.controller';

// Core services and modules
import { CoreModule } from '@core/core.module';
import { InfrastructureModule } from '@infrastructure/infrastructure.module';
import { StorageModule as InfraStorageModule } from '@infrastructure/storage/storage.module';

// Command Handlers
import { GeneratePartUrlHandler } from '@application/commands/storage/generate-part-url.command';
import { CompleteMultipartUploadHandler } from '@application/commands/storage/complete-multipart-upload.command';
import { AbortMultipartUploadHandler } from '@application/commands/storage/abort-multipart-upload.command';
import { MoveFileHandler } from '@application/commands/storage/move-file.command';
import { RenameFileHandler } from '@application/commands/storage/rename-file.command';
import { SetFileVisibilityHandler } from '@application/commands/storage/set-file-visibility.command';
import { ClearUserConcurrencySlotsHandler } from '@application/commands/storage/clear-user-concurrency-slots.command';
import { HeartbeatUploadHandler } from '@application/commands/storage/heartbeat-upload.command';
import { CreateUserFolderHandler } from '@application/commands/storage/create-user-folder.command';
import { CreateCommonFolderHandler } from '@application/commands/storage/create-common-folder.command';
import { DeleteUserFolderHandler } from '@application/commands/storage/delete-user-folder.command';
import { DeleteCommonFolderHandler } from '@application/commands/storage/delete-common-folder.command';
import { DeleteCommonFileHandler } from '@application/commands/storage/delete-common-file.command';
import { DeleteUserFileHandler } from '@application/commands/storage/delete-user-file.command';
import { InitiateUserUploadHandler } from '@application/commands/storage/initiate-user-upload.command';
import { InitiateCommonUploadHandler } from '@application/commands/storage/initiate-common-upload.command';

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
import { GetFilesHandler } from '@application/queries/storage/get-files.query';
import { GetFileByIdHandler } from '@application/queries/storage/get-file-by-id.query';
import { GetDirectoryContentsHandler } from '@application/queries/storage/get-directory-contents.query';
import { GetCommonDirectoryContentsHandler } from '@application/queries/storage/get-common-directory-contents.query';
import { GetAllUserFilesHandler } from '@application/queries/storage/get-all-user-files.query';

// Application services
import { EnhancedFileMapper } from '@application/mappers/enhanced-file.mapper';

const commandHandlers = [
  // Simplified context-specific handlers
  InitiateUserUploadHandler,
  InitiateCommonUploadHandler,
  CreateUserFolderHandler,
  CreateCommonFolderHandler,
  DeleteUserFolderHandler,
  DeleteCommonFolderHandler,
  DeleteCommonFileHandler,
  DeleteUserFileHandler,
  // Core file operation handlers
  GeneratePartUrlHandler,
  CompleteMultipartUploadHandler,
  AbortMultipartUploadHandler,
  MoveFileHandler,
  RenameFileHandler,
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
  GetFilesHandler,
  GetFileByIdHandler,
  GetDirectoryContentsHandler,
  GetCommonDirectoryContentsHandler,
  GetAllUserFilesHandler,
];

@Module({
  imports: [CqrsModule, CoreModule, InfrastructureModule, InfraStorageModule],
  controllers: [StorageController, PublicStorageController, StorageCommonController],
  providers: [
    // Command handlers
    ...commandHandlers,

    // Query handlers
    ...queryHandlers,

    // Application services
    EnhancedFileMapper,
  ],
  exports: [],
})
export class StorageModule {}
