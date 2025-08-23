import { ICommand, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileOperationsService } from '@core/services/file-operations.service';
import { IFileRepository } from '@core/repositories/file.repository.interface';
import { IStorageService } from '@core/repositories/storage.service.interface';
import { FILE_REPOSITORY, STORAGE_SERVICE } from '@shared/constants/tokens';
import { StoragePaths } from '@core/utils/storage-paths';
import { EntityNotFoundException } from '@core/exceptions/domain-exceptions';

export class DeleteUserFolderCommand implements ICommand {
  constructor(
    public readonly path: string,
    public readonly userId: string,
    public readonly companyId: string,
  ) {}
}

@Injectable()
@CommandHandler(DeleteUserFolderCommand)
export class DeleteUserFolderHandler
  implements ICommandHandler<DeleteUserFolderCommand, { deletedCount: number }>
{
  constructor(
    private readonly fileOperationsService: FileOperationsService,
    @Inject(FILE_REPOSITORY)
    private readonly fileRepository: IFileRepository,
    @Inject(STORAGE_SERVICE)
    private readonly storageService: IStorageService,
    private readonly configService: ConfigService,
  ) {}

  async execute(command: DeleteUserFolderCommand): Promise<{ deletedCount: number }> {
    const { path, userId, companyId } = command;

    // Build storage path: company-uuid/users/user-uuid/{path}
    const storagePath = StoragePaths.forUser(companyId, userId, path);
    const bucket = this.configService.get<string>('storage.defaultBucket', 'nauto-console-dev');

    let totalDeletedCount = 0;

    // 1. Delete files from database (user owns all files in their space)
    try {
      const dbResult = await this.fileOperationsService.deletePhysicalFolder({
        storagePath,
        userId,
        companyId,
      });
      totalDeletedCount += dbResult.deletedCount;
    } catch (error) {
      // If folder doesn't exist in DB, that's OK - we'll check physical
      if (!(error instanceof EntityNotFoundException)) {
        throw error;
      }
    }

    // 2. Delete physical files that are not in database
    const physicalDeletedCount = await this.deletePhysicalOnlyFiles(bucket, storagePath, userId);
    totalDeletedCount += physicalDeletedCount;

    // 3. If folder is now empty, delete the folder itself
    if (totalDeletedCount > 0) {
      try {
        const remainingFiles = await this.fileRepository.findByBucketAndPrefix(bucket, storagePath);
        const activeFiles = remainingFiles.filter(
          file => !file.status.isDeleted() && file.userId === userId,
        );

        if (activeFiles.length === 0) {
          // Check if there are any physical files left
          const physicalFiles = await this.storageService.listObjectsByPrefix(
            bucket,
            `${storagePath}/`,
          );
          const actualFiles = physicalFiles.filter(key => !key.endsWith('/'));

          if (actualFiles.length === 0) {
            await this.storageService.deleteFolder(bucket, storagePath);
          }
        }
      } catch (error) {
        // If folder cleanup fails, don't fail the whole operation
        console.warn('Failed to clean up empty folder:', error);
      }
    }

    // If no files were deleted at all, check if folder exists
    if (totalDeletedCount === 0) {
      const folderExists = await this.storageService.folderExists(bucket, storagePath);
      if (!folderExists) {
        throw new EntityNotFoundException('Folder', path || 'root');
      }
    }

    return { deletedCount: totalDeletedCount };
  }

  private async deletePhysicalOnlyFiles(
    bucket: string,
    storagePath: string,
    userId: string,
  ): Promise<number> {
    try {
      // Get all physical files in the folder
      const folderPrefix = storagePath.endsWith('/') ? storagePath : `${storagePath}/`;
      const allPhysicalFiles = await this.storageService.listObjectsByPrefix(bucket, folderPrefix);

      // Filter to get only files (not folder markers)
      const actualFiles = allPhysicalFiles.filter(key => !key.endsWith('/'));

      if (actualFiles.length === 0) {
        return 0;
      }

      // Get all files from database in this path for this user
      const dbFiles = await this.fileRepository.findByBucketAndPrefix(bucket, storagePath);
      const userDbFiles = dbFiles.filter(file => file.userId === userId);
      const dbObjectKeys = new Set(userDbFiles.map(file => file.objectKey.toString()));

      // Find physical files that are NOT in database
      const physicalOnlyFiles = actualFiles.filter(objectKey => !dbObjectKeys.has(objectKey));

      if (physicalOnlyFiles.length === 0) {
        return 0;
      }

      // Delete physical-only files (in user space, user can delete all physical files)
      await this.storageService.deleteObjects(bucket, physicalOnlyFiles);

      return physicalOnlyFiles.length;
    } catch (error) {
      console.warn('Failed to delete physical-only files:', error);

      return 0;
    }
  }
}
