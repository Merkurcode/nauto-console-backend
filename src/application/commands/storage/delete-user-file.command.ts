import { ICommand, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IFileRepository } from '@core/repositories/file.repository.interface';
import { IStorageService } from '@core/repositories/storage.service.interface';
import { FileOperationsService } from '@core/services/file-operations.service';
import { FILE_REPOSITORY, STORAGE_SERVICE } from '@shared/constants/tokens';
import { EntityNotFoundException } from '@core/exceptions/domain-exceptions';
import { File } from '@core/entities/file.entity';

export class DeleteUserFileCommand implements ICommand {
  constructor(
    public readonly path: string,
    public readonly filename: string,
    public readonly userId: string,
    public readonly companyId: string,
  ) {}
}

@Injectable()
@CommandHandler(DeleteUserFileCommand)
export class DeleteUserFileHandler implements ICommandHandler<DeleteUserFileCommand, void> {
  constructor(
    @Inject(FILE_REPOSITORY)
    private readonly fileRepository: IFileRepository,

    @Inject(STORAGE_SERVICE)
    private readonly storageService: IStorageService,

    private readonly fileOperationsService: FileOperationsService,
    private readonly configService: ConfigService,
  ) {}

  async execute(command: DeleteUserFileCommand): Promise<void> {
    const { path, filename, userId, companyId } = command;

    // Build full storage path for the file
    const fullStoragePath = this.buildUserStoragePath(companyId, userId, path);
    const bucket = this.configService.get<string>('storage.defaultBucket', 'nauto-console-dev');
    const objectKey = `${fullStoragePath}/${filename}`;

    // Try to find file in database first
    const dbFile = await this.findFileInDatabase(fullStoragePath, filename, userId);

    if (dbFile) {
      // File exists in database - use existing file operations service
      await this.fileOperationsService.deleteFile({
        fileId: dbFile.id.toString(),
        userId,
        hardDelete: true, // Force physical deletion
      });
    } else {
      // File only exists physically in MinIO - check existence first, then delete
      const physicalExists = await this.storageService.objectExists(bucket, objectKey);

      if (!physicalExists) {
        throw new EntityNotFoundException('File', filename);
      }

      // Delete physical file directly (no database record to delete first)
      await this.storageService.deleteObject(bucket, objectKey);
    }
  }

  private buildUserStoragePath(companyId: string, userId: string, path: string): string {
    const basePath = `${companyId}/users/${userId}`;

    return path ? `${basePath}/${path}` : basePath;
  }

  private async findFileInDatabase(
    storagePath: string,
    filename: string,
    userId: string,
  ): Promise<File | null> {
    try {
      const files = await this.fileRepository.findByPath(storagePath);

      return files.find(file => file.filename === filename && file.userId === userId) || null;
    } catch (_error) {
      // File not found in database
      return null;
    }
  }
}
