import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { StorageController } from './storage.controller';
import { StorageModule as InfrastructureStorageModule } from '../../../infrastructure/storage/storage.module';
import { CoreModule } from '@core/core.module';

// Commands
import { UploadFileCommandHandler } from '@application/commands/storage/upload-file.command';
import { DeleteFileCommandHandler } from '@application/commands/storage/delete-file.command';
import { UpdateFileAccessCommandHandler } from '@application/commands/storage/update-file-access.command';

// Queries
import { GetFileQueryHandler } from '@application/queries/storage/get-file.query';
import { GetUserFilesQueryHandler } from '@application/queries/storage/get-user-files.query';

// Mappers
import { FileMapper } from '@application/mappers/file.mapper';

const CommandHandlers = [
  UploadFileCommandHandler,
  DeleteFileCommandHandler,
  UpdateFileAccessCommandHandler,
];

const QueryHandlers = [GetFileQueryHandler, GetUserFilesQueryHandler];

@Module({
  imports: [CqrsModule, InfrastructureStorageModule.register({ global: true }), CoreModule],
  controllers: [StorageController],
  providers: [...CommandHandlers, ...QueryHandlers, FileMapper],
})
export class StorageModule {}
