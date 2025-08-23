import { ICommand, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IFileRepository } from '@core/repositories/file.repository.interface';
import { IStorageService } from '@core/repositories/storage.service.interface';
import { FILE_REPOSITORY, STORAGE_SERVICE } from '@shared/constants/tokens';
import { StorageAreaType } from '@shared/types/storage-areas.types';
import { EntityNotFoundException } from '@core/exceptions/domain-exceptions';

export class DeleteCommonFolderCommand implements ICommand {
  constructor(
    public readonly area: StorageAreaType,
    public readonly path: string,
    public readonly userId: string,
    public readonly companyId: string,
  ) {}
}

@Injectable()
@CommandHandler(DeleteCommonFolderCommand)
export class DeleteCommonFolderHandler
  implements ICommandHandler<DeleteCommonFolderCommand, { deletedCount: number }>
{
  constructor(
    @Inject(FILE_REPOSITORY)
    private readonly fileRepository: IFileRepository,
    @Inject(STORAGE_SERVICE)
    private readonly storageService: IStorageService,
    private readonly configService: ConfigService,
  ) {}

  async execute(command: DeleteCommonFolderCommand): Promise<{ deletedCount: number }> {
    const { area, path, userId, companyId } = command;

    const storagePath = `${companyId}/common/${area}/${path}`
      .replace(/\/+/g, '/')
      .replace(/\/$/, '');

    const bucket = this.configService.get<string>('storage.defaultBucket', 'nauto-console-dev');

    const hasContent = await this.checkFolderExistence(bucket, storagePath);
    if (!hasContent) {
      throw new EntityNotFoundException('Folder', path || 'root');
    }

    const totalDeletedCount = await this.depthFirstDelete(bucket, storagePath, userId, companyId);

    return { deletedCount: totalDeletedCount };
  }

  private async depthFirstDelete(
    bucket: string,
    currentPath: string,
    userId: string,
    companyId: string,
    rootPath?: string,
  ): Promise<number> {
    let totalDeleted = 0;
    const actualRootPath = rootPath || currentPath;
    const rootDepth = this.getPathDepth(actualRootPath);
    const currentDepth = this.getPathDepth(currentPath);

    try {
      const subfolders = await this.getImmediateSubfolders(bucket, currentPath);

      for (const subfolderPath of subfolders) {
        const subfolderDeleted = await this.depthFirstDelete(
          bucket,
          subfolderPath,
          userId,
          companyId,
          actualRootPath,
        );
        totalDeleted += subfolderDeleted;
      }

      const dbDeleted = await this.deleteCurrentFolderFiles(currentPath, userId, companyId);
      totalDeleted += dbDeleted;

      const physicalDeleted = await this.deleteCurrentFolderPhysicalFiles(bucket, currentPath);
      totalDeleted += physicalDeleted;

      if (currentDepth >= rootDepth) {
        await this.deleteCurrentFolderIfEmpty(bucket, currentPath);
      }

      return totalDeleted;
    } catch (error) {
      console.warn(`Failed to process folder ${currentPath}:`, error);

      return totalDeleted;
    }
  }

  private getPathDepth(path: string): number {
    const cleanPath = path.replace(/^\/+|\/+$/g, '');
    if (cleanPath === '') {
      return 0;
    }

    return cleanPath.split(/\/+/).filter(segment => segment.length > 0).length;
  }

  private async getImmediateSubfolders(bucket: string, parentPath: string): Promise<string[]> {
    try {
      const folderPrefix = parentPath.endsWith('/') ? parentPath : `${parentPath}/`;
      const allObjects = await this.storageService.listObjectsByPrefix(bucket, folderPrefix);

      const subfolders = new Set<string>();

      for (const objectKey of allObjects) {
        const relativePath = objectKey.replace(folderPrefix, '');

        if (!relativePath) continue;

        if (relativePath.includes('/')) {
          const firstFolder = relativePath.split('/')[0];
          if (firstFolder) {
            subfolders.add(`${folderPrefix}${firstFolder}`);
          }
        }
      }

      const dbFiles = await this.fileRepository.findByBucketAndPrefix(bucket, parentPath);
      for (const file of dbFiles) {
        if (file.path !== parentPath && file.path.startsWith(folderPrefix)) {
          const relativePath = file.path.replace(folderPrefix, '');
          if (relativePath.includes('/')) {
            const firstFolder = relativePath.split('/')[0];
            if (firstFolder) {
              subfolders.add(`${folderPrefix}${firstFolder}`);
            }
          }
        }
      }

      return Array.from(subfolders);
    } catch (error) {
      console.warn(`Failed to get subfolders for ${parentPath}:`, error);

      return [];
    }
  }

  private async deleteCurrentFolderFiles(
    storagePath: string,
    userId: string,
    _companyId: string,
  ): Promise<number> {
    try {
      const files = await this.fileRepository.findByPath(storagePath);
      const filesToDelete = files.filter(file => file.userId === userId || file.isPublic);

      if (filesToDelete.length === 0) {
        return 0;
      }

      const bucket = this.configService.get<string>('storage.defaultBucket', 'nauto-console-dev');
      let deletedCount = 0;

      for (const file of filesToDelete) {
        try {
          if (file.status.isUploaded()) {
            await this.storageService.deleteObject(bucket, file.objectKey.toString());
          }

          file.markAsDeleted();
          await this.fileRepository.update(file);
          deletedCount++;
        } catch (fileError) {
          console.warn(`Failed to delete file ${file.id}:`, fileError);
        }
      }

      return deletedCount;
    } catch (error) {
      console.warn(`Failed to delete DB files in ${storagePath}:`, error);

      return 0;
    }
  }

  private async deleteCurrentFolderPhysicalFiles(
    bucket: string,
    storagePath: string,
  ): Promise<number> {
    try {
      const folderPrefix = storagePath.endsWith('/') ? storagePath : `${storagePath}/`;
      const allObjects = await this.storageService.listObjectsByPrefix(bucket, folderPrefix);

      const directFiles = allObjects.filter(key => {
        const relativePath = key.replace(folderPrefix, '');

        return relativePath.length > 0 && !relativePath.includes('/') && !key.endsWith('/');
      });

      if (directFiles.length === 0) {
        return 0;
      }

      const dbFiles = await this.fileRepository.findByPath(storagePath);
      const dbObjectKeys = new Set(dbFiles.map(file => file.objectKey.toString()));

      const orphanedFiles = directFiles.filter(objectKey => !dbObjectKeys.has(objectKey));

      if (orphanedFiles.length === 0) {
        return 0;
      }

      await this.storageService.deleteObjects(bucket, orphanedFiles);

      return orphanedFiles.length;
    } catch (error) {
      console.warn(`Failed to delete physical files in ${storagePath}:`, error);

      return 0;
    }
  }

  private async deleteCurrentFolderIfEmpty(bucket: string, storagePath: string): Promise<void> {
    try {
      const dbFiles = await this.fileRepository.findByPath(storagePath);
      const activeDbFiles = dbFiles.filter(file => !file.status.isDeleted());

      if (activeDbFiles.length > 0) {
        return;
      }

      const folderPrefix = storagePath.endsWith('/') ? storagePath : `${storagePath}/`;
      const physicalFiles = await this.storageService.listObjectsByPrefix(bucket, folderPrefix);
      const directFiles = physicalFiles.filter(key => {
        const relativePath = key.replace(folderPrefix, '');

        return relativePath.length > 0 && !relativePath.includes('/') && !key.endsWith('/');
      });

      if (directFiles.length > 0) {
        return;
      }

      try {
        await this.storageService.deleteFolder(bucket, storagePath);
      } catch (_error) {
        // Folder might not exist as a marker, that's OK
      }
    } catch (error) {
      console.warn(`Failed to check/delete empty folder ${storagePath}:`, error);
    }
  }

  private async checkFolderExistence(bucket: string, storagePath: string): Promise<boolean> {
    try {
      const folderExists = await this.storageService.folderExists(bucket, storagePath);
      if (folderExists) {
        return true;
      }

      const dbFiles = await this.fileRepository.findByBucketAndPrefix(bucket, storagePath);
      if (dbFiles.length > 0) {
        return true;
      }

      const folderPrefix = storagePath.endsWith('/') ? storagePath : `${storagePath}/`;
      const physicalFiles = await this.storageService.listObjectsByPrefix(bucket, folderPrefix);

      return physicalFiles.length > 0;
    } catch (_error) {
      return false;
    }
  }
}
