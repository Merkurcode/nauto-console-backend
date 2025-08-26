import { ICommand, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IFileRepository } from '@core/repositories/file.repository.interface';
import { IStorageService } from '@core/repositories/storage.service.interface';
import { FileOperationsService } from '@core/services/file-operations.service';
import { FILE_REPOSITORY, STORAGE_SERVICE } from '@shared/constants/tokens';
import { StorageAreaType } from '@shared/types/storage-areas.types';
import { EntityNotFoundException } from '@core/exceptions/domain-exceptions';

export class DeleteCommonFileCommand implements ICommand {
  constructor(
    public readonly area: StorageAreaType,
    public readonly path: string,
    public readonly filename: string,
    public readonly userId: string,
    public readonly companyId: string,
  ) {}
}

@Injectable()
@CommandHandler(DeleteCommonFileCommand)
export class DeleteCommonFileHandler implements ICommandHandler<DeleteCommonFileCommand, void> {
  constructor(
    @Inject(FILE_REPOSITORY)
    private readonly fileRepository: IFileRepository,

    @Inject(STORAGE_SERVICE)
    private readonly storageService: IStorageService,

    private readonly fileOperationsService: FileOperationsService,
    private readonly configService: ConfigService,
  ) {}

  async execute(command: DeleteCommonFileCommand): Promise<void> {
    const { area, path, filename, userId, companyId } = command;

    // Build full storage path for the file
    const fullStoragePath = this.buildCommonStoragePath(companyId, area, path);
    const bucket = this.configService.get<string>('storage.defaultBucket', 'nauto-console-dev');
    const objectKey = `${fullStoragePath}/${filename}`;

    // Try to find file in database first
    const dbFiles = await this.fileRepository.findByBucketPathAndFilename(
      bucket,
      fullStoragePath,
      filename,
    );
    const dbFile = dbFiles[0];

    if (dbFile) {
      // File exists in database - use existing file operations service
      await this.fileOperationsService.deleteFile({
        fileId: dbFile.id.toString(),
        userId,
        hardDelete: true, // Force physical deletion
        commonArea: true,
      });
    } else {
      // File only exists physically in MinIO - check existence first, then delete
      const physicalExists = await this.storageService.objectExists(bucket, objectKey);

      if (!physicalExists) {
        throw new EntityNotFoundException('File', filename);
      }

      // Delete physical file directly (no database record to delete first)
      // In common areas, physical files without DB records are considered "orphaned"
      // and can be cleaned up by any authenticated user to prevent storage leaks
      await this.storageService.deleteObject(bucket, objectKey);
    }
  }

  private buildCommonStoragePath(companyId: string, area: string, path: string): string {
    const basePath = `${companyId}/common/${area}`;

    return path ? `${basePath}/${path}` : basePath;
  }
}
