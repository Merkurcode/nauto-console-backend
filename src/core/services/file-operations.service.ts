import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventBus } from '@nestjs/cqrs';

import { IFileRepository } from '@core/repositories/file.repository.interface';
import { IStorageService } from '@core/repositories/storage.service.interface';

import { File } from '@core/entities/file.entity';

import { StorageOperationFailedException } from '@core/exceptions/storage-domain.exceptions';
import {
  EntityNotFoundException,
  InvalidFileOperationException,
} from '@core/exceptions/domain-exceptions';
import { FileLockService } from './file-lock.service';
import { FileAccessControlService } from './file-access-control.service';
import { MultipartUploadService } from './multipart-upload.service';
import { ILogger } from '@core/interfaces/logger.interface';

import { FILE_REPOSITORY, STORAGE_SERVICE, LOGGER_SERVICE } from '@shared/constants/tokens';

export interface IMoveFileParams {
  fileId: string;
  newStoragePath: string; // Full path determined by endpoint
  userId: string;
  overwrite?: boolean;
}

export interface IRenameFileParams {
  fileId: string;
  newFilename: string;
  userId: string;
  overwrite?: boolean;
}

export interface IDeleteFileParams {
  fileId: string;
  userId: string;
  hardDelete?: boolean;
}

export interface ISetVisibilityParams {
  fileId: string;
  isPublic: boolean;
  userId: string;
}

export interface IGenerateSignedUrlParams {
  fileId: string;
  expirationSeconds?: number;
  userId: string;
}

export interface ICreateFolderParams {
  storagePath: string; // Full path determined by endpoint
  userId: string;
  companyId: string;
}

export interface IDeleteFolderParams {
  storagePath: string; // Full path determined by endpoint
  userId: string;
  companyId: string;
}

@Injectable()
export class FileOperationsService {
  private readonly MOVE_COPY_CONCURRENCY = 8;

  constructor(
    @Inject(FILE_REPOSITORY)
    private readonly fileRepository: IFileRepository,

    @Inject(STORAGE_SERVICE)
    private readonly storageService: IStorageService,

    @Inject(LOGGER_SERVICE)
    private readonly logger: ILogger,

    private readonly configService: ConfigService,
    private readonly eventBus: EventBus,
    private readonly fileLockService: FileLockService,
    private readonly fileAccessControlService: FileAccessControlService,
    private readonly multipartUploadService: MultipartUploadService,
  ) {}

  private publishAndClearDomainEvents(file: File) {
    const events = file.getDomainEvents?.();
    for (const e of events) this.eventBus.publish(e);
    file.clearDomainEvents?.();
  }

  private async ensureDestinationAvailable(bucket: string, destKey: string, overwrite?: boolean) {
    const exists = await this.storageService.objectExists(bucket, destKey);
    if (exists && !overwrite) {
      throw new InvalidFileOperationException('move/rename', 'Destination already exists', destKey);
    }
  }

  /** Move file to new storage path */
  async moveFile(params: IMoveFileParams): Promise<File> {
    const { fileId, newStoragePath, userId, overwrite } = params;

    return this.fileLockService.withFileLock(fileId, async () => {
      const file = await this.fileRepository.findById(fileId);
      if (!file) throw new EntityNotFoundException('File', fileId);

      const userPayload = { sub: userId };
      this.fileAccessControlService.validateFileAccess(file, userPayload, 'write');

      if (!file.canBeMoved()) {
        throw new InvalidFileOperationException('move', 'File cannot be moved', fileId);
      }

      // Ensure intermediate directories exist for the new path
      await this.createIntermediateDirectories(file.bucket, newStoragePath);

      // Path already validated by endpoint context
      const newObjectKey = `${newStoragePath}/${file.filename}`;
      const oldObjectKey = file.objectKey.toString();

      if (oldObjectKey === newObjectKey) return file;

      // If not uploaded yet, just update path
      if (!file.status.isUploaded()) {
        file.move(newStoragePath);
        const updated = await this.fileRepository.update(file);
        this.publishAndClearDomainEvents(file);

        return updated;
      }

      // Move in storage
      await this.ensureDestinationAvailable(file.bucket, newObjectKey, overwrite);

      try {
        await this.storageService.copyObject(file.bucket, oldObjectKey, file.bucket, newObjectKey);

        file.move(newStoragePath);
        const updated = await this.fileRepository.update(file);

        await this.storageService.deleteObject(file.bucket, oldObjectKey);
        this.publishAndClearDomainEvents(file);

        return updated;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new StorageOperationFailedException('move file', errorMessage, { fileId });
      }
    });
  }

  /** Rename file */
  async renameFile(params: IRenameFileParams): Promise<File> {
    const { fileId, newFilename, userId, overwrite } = params;

    return this.fileLockService.withFileLock(fileId, async () => {
      const file = await this.fileRepository.findById(fileId);
      if (!file) throw new EntityNotFoundException('File', fileId);

      const userPayload = { sub: userId };
      this.fileAccessControlService.validateFileAccess(file, userPayload, 'write');

      if (!file.canBeRenamed()) {
        throw new InvalidFileOperationException(
          'rename',
          'Cannot rename file while uploading. Please wait for upload to complete.',
          fileId,
        );
      }

      const newObjectKey = `${file.path}/${newFilename}`;
      const oldObjectKey = file.objectKey.toString();

      if (oldObjectKey === newObjectKey) return file;

      // If not uploaded yet, just update filename
      if (!file.status.isUploaded()) {
        file.rename(newFilename);
        const updated = await this.fileRepository.update(file);
        this.publishAndClearDomainEvents(file);

        return updated;
      }

      // Perform physical rename in bucket first (complete physical operation)
      await this.ensureDestinationAvailable(file.bucket, newObjectKey, overwrite);

      try {
        // Step 1: Copy to new location
        this.logger.log({
          message: 'Starting physical file copy',
          fileId,
          oldObjectKey,
          newObjectKey,
        });

        await this.storageService.copyObject(file.bucket, oldObjectKey, file.bucket, newObjectKey);

        // Step 2: Delete old file (complete physical rename)
        this.logger.log({
          message: 'Starting deletion of old file',
          fileId,
          oldObjectKey,
        });

        await this.storageService.deleteObject(file.bucket, oldObjectKey);

        this.logger.log({
          message: 'Physical rename completed in bucket',
          fileId,
          oldObjectKey,
          newObjectKey,
        });

        // Step 3: Update database only after physical rename is complete
        file.rename(newFilename);
        const updated = await this.fileRepository.update(file);
        this.publishAndClearDomainEvents(file);

        this.logger.log({
          message: 'File rename completed successfully',
          fileId,
          newFilename,
        });

        return updated;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        this.logger.error({
          message: 'File rename failed',
          fileId,
          oldObjectKey,
          newObjectKey,
          error: errorMessage,
        });

        throw new StorageOperationFailedException('rename file', errorMessage, { fileId });
      }
    });
  }

  /** Delete file */
  async deleteFile(params: IDeleteFileParams): Promise<void> {
    const { fileId, userId, hardDelete = false } = params;

    return this.fileLockService.withFileLock(fileId, async () => {
      const file = await this.fileRepository.findById(fileId);
      if (!file) throw new EntityNotFoundException('File', fileId);

      const userPayload = { sub: userId };
      this.fileAccessControlService.validateFileAccess(file, userPayload, 'delete');

      // If file is uploading, abort the multipart upload first
      if (file.status.isUploading()) {
        this.logger.log({
          message: 'Aborting active upload before deletion',
          fileId,
          uploadId: file.uploadId?.toString(),
        });

        try {
          await this.multipartUploadService.abortUpload(fileId, 'File deletion requested');
        } catch (abortError) {
          this.logger.warn({
            message: 'Failed to abort upload, proceeding with deletion',
            fileId,
            error: abortError instanceof Error ? abortError.message : 'Unknown error',
          });
        }

        // Reload file to get updated status after abort
        const updatedFile = await this.fileRepository.findById(fileId);
        if (updatedFile) {
          Object.assign(file, updatedFile);
        }
      }

      try {
        if (file.status.isUploaded()) {
          await this.storageService.deleteObject(file.bucket, file.objectKey.toString());
        }

        if (hardDelete) {
          await this.fileRepository.delete(fileId);
        } else {
          file.markAsDeleted();
          await this.fileRepository.update(file);
          this.publishAndClearDomainEvents(file);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new StorageOperationFailedException('delete file', errorMessage, { fileId });
      }
    });
  }

  /** Set file visibility */
  async setFileVisibility(params: ISetVisibilityParams): Promise<File> {
    const { fileId, isPublic, userId } = params;

    return this.fileLockService.withFileLock(fileId, async () => {
      const file = await this.fileRepository.findById(fileId);
      if (!file) throw new EntityNotFoundException('File', fileId);

      const userPayload = { sub: userId };
      this.fileAccessControlService.validateFileAccess(file, userPayload, 'write');

      if (!file.status.isUploaded()) {
        throw new InvalidFileOperationException('set visibility', 'File must be uploaded', fileId);
      }

      try {
        if (isPublic) {
          await this.storageService.setObjectPublic(file.bucket, file.objectKey.toString());
          file.makePublic();
        } else {
          await this.storageService.setObjectPrivate(file.bucket, file.objectKey.toString());
          file.makePrivate();
        }

        const updated = await this.fileRepository.update(file);
        this.publishAndClearDomainEvents(file);

        return updated;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        throw new StorageOperationFailedException('set visibility', errorMessage, { fileId });
      }
    });
  }

  /** Generate signed URL */
  async generateSignedUrl(params: IGenerateSignedUrlParams): Promise<string> {
    const { fileId, expirationSeconds, userId } = params;

    const file = await this.fileRepository.findById(fileId);
    if (!file) throw new EntityNotFoundException('File', fileId);

    const userPayload = { sub: userId };
    this.fileAccessControlService.validateFileAccess(file, userPayload, 'read');

    if (!file.status.isUploaded()) {
      throw new InvalidFileOperationException('generate URL', 'File must be uploaded', fileId);
    }

    const expiry =
      expirationSeconds ?? this.configService.get<number>('storage.presign.expirySec') ?? 3600;

    try {
      const { url } = await this.storageService.generatePresignedGetUrl(
        file.bucket,
        file.objectKey.toString(),
        expiry,
      );

      return url;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new StorageOperationFailedException('generate URL', errorMessage, { fileId });
    }
  }

  /** Create physical folder in storage with intermediate directories */
  async createFolder(params: ICreateFolderParams): Promise<{ path: string }> {
    const { storagePath, userId, companyId } = params;
    const bucket = this.configService.get<string>('storage.defaultBucket', 'nauto-console-dev');

    try {
      // Create all intermediate directories as separate MinIO objects
      await this.createIntermediateDirectories(bucket, storagePath);

      this.logger.log({
        message: 'Folder hierarchy created successfully',
        bucket,
        storagePath,
        userId,
        companyId,
      });

      return { path: storagePath };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error({
        message: 'Failed to create folder',
        bucket,
        storagePath,
        userId,
        companyId,
        error: errorMessage,
      });

      throw new StorageOperationFailedException('create folder', errorMessage, {
        storagePath,
        userId,
        companyId,
      });
    }
  }

  /** Create intermediate directories as separate MinIO objects */
  private async createIntermediateDirectories(bucket: string, storagePath: string): Promise<void> {
    // Clean path and split into segments
    const cleanPath = storagePath.replace(/^\/+|\/+$/g, '');
    if (cleanPath === '') {
      return; // Root level, nothing to create
    }

    const segments = cleanPath.split('/').filter(segment => segment.length > 0);

    // Create each level of the directory hierarchy
    for (let i = 1; i <= segments.length; i++) {
      const currentPath = segments.slice(0, i).join('/');

      this.logger.log({
        message: 'Creating directory level',
        bucket,
        directoryPath: currentPath,
        level: i,
        totalLevels: segments.length,
      });

      // Create this directory level as a separate object
      await this.storageService.createFolder(bucket, currentPath);
    }
  }

  /** Delete physical folder from storage */
  async deletePhysicalFolder(params: IDeleteFolderParams): Promise<{ deletedCount: number }> {
    const { storagePath, userId, companyId } = params;
    const bucket = this.configService.get<string>('storage.defaultBucket', 'nauto-console-dev');

    try {
      // Check if folder exists before attempting to delete
      const exists = await this.storageService.folderExists(bucket, storagePath);
      if (!exists) {
        this.logger.warn({
          message: 'Folder does not exist, skipping deletion',
          bucket,
          storagePath,
          userId,
          companyId,
        });

        return { deletedCount: 0 };
      }

      // Delete the folder physically from storage
      await this.storageService.deleteFolder(bucket, storagePath);

      // Also delete any file records that were in this folder
      const deletedFileRecords = await this.fileRepository.deleteFilesByPrefix(
        storagePath,
        companyId,
      );

      this.logger.log({
        message: 'Folder deleted successfully',
        bucket,
        storagePath,
        userId,
        companyId,
        deletedFileRecords,
      });

      return { deletedCount: deletedFileRecords };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error({
        message: 'Failed to delete folder',
        bucket,
        storagePath,
        userId,
        companyId,
        error: errorMessage,
      });

      throw new StorageOperationFailedException('delete folder', errorMessage, {
        storagePath,
        userId,
        companyId,
      });
    }
  }

  /** Delete common folder with selective file deletion (only owned or public files) */
  async deleteCommonFolderSelective(
    params: IDeleteFolderParams,
  ): Promise<{ deletedCount: number }> {
    const { storagePath, userId, companyId } = params;
    const bucket = this.configService.get<string>('storage.defaultBucket', 'nauto-console-dev');

    try {
      // Get ALL files in this folder and ALL subfolders (recursive)
      const files = await this.fileRepository.findByBucketAndPrefix(bucket, storagePath);

      if (files.length === 0) {
        // Check if folder exists physically (including subfolders)
        const hasContent = await this.checkFolderExistence(bucket, storagePath);
        if (!hasContent) {
          this.logger.warn({
            message: 'Folder does not exist',
            bucket,
            storagePath,
            userId,
            companyId,
          });

          throw new EntityNotFoundException('Folder', storagePath);
        }

        // Empty folder exists, delete it
        await this.storageService.deleteFolder(bucket, storagePath);
        this.logger.log({
          message: 'Empty folder deleted',
          bucket,
          storagePath,
          userId,
          companyId,
        });

        return { deletedCount: 0 };
      }

      // Filter files - only delete owned or public files
      const filesToDelete = files.filter(file => file.userId === userId || file.isPublic);

      if (filesToDelete.length === 0) {
        this.logger.log({
          message: 'No files to delete - all files are private and owned by others',
          bucket,
          storagePath,
          userId,
          companyId,
          totalFiles: files.length,
        });

        return { deletedCount: 0 };
      }

      // Delete files with file locks
      const fileIds = filesToDelete.map(f => f.id);

      return await this.fileLockService.withMultipleFileLocks(fileIds, async () => {
        let deletedCount = 0;

        // Delete from storage (uploaded files only)
        const uploadedFilesToDelete = filesToDelete.filter(f => f.status.isUploaded());
        const objectKeysToDelete = uploadedFilesToDelete.map(f => f.objectKey.toString());

        if (objectKeysToDelete.length > 0) {
          await this.storageService.deleteObjects(bucket, objectKeysToDelete);
        }

        // Mark all selected files as deleted in database
        for (const file of filesToDelete) {
          file.markAsDeleted();
          await this.fileRepository.update(file);
          this.publishAndClearDomainEvents(file);
          deletedCount++;
        }

        // Check if folder is now empty and delete it if so
        const remainingFiles = await this.fileRepository.findByBucketAndPrefix(bucket, storagePath);
        const activeRemainingFiles = remainingFiles.filter(f => !f.status.isDeleted());

        if (activeRemainingFiles.length === 0) {
          await this.storageService.deleteFolder(bucket, storagePath);
          this.logger.log({
            message: 'Folder deleted after removing all accessible files',
            bucket,
            storagePath,
            userId,
            companyId,
          });
        }

        this.logger.log({
          message: 'Selective folder deletion completed',
          bucket,
          storagePath,
          userId,
          companyId,
          deletedCount,
          totalFiles: files.length,
          remainingFiles: activeRemainingFiles.length,
        });

        return { deletedCount };
      });
    } catch (error) {
      // Re-throw EntityNotFoundException as-is to preserve 404 mapping
      if (error instanceof EntityNotFoundException) {
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error({
        message: 'Failed to delete common folder selectively',
        bucket,
        storagePath,
        userId,
        companyId,
        error: errorMessage,
      });

      throw new StorageOperationFailedException('delete common folder', errorMessage, {
        storagePath,
        userId,
        companyId,
      });
    }
  }

  /** Move folder (batch move files with path prefix) */
  async renameFolder(params: {
    fromPrefix: string;
    toPrefix: string;
    userId: string;
    overwrite?: boolean;
  }): Promise<{ movedCount: number }> {
    const { fromPrefix, toPrefix, userId, overwrite } = params;
    const bucket = this.configService.get<string>('storage.defaultBucket', 'nauto-console-dev');

    try {
      const files = await this.fileRepository.findByBucketAndPrefix(bucket, fromPrefix);
      const userPayload = { sub: userId };

      const allowed = files.filter(f => {
        try {
          this.fileAccessControlService.validateFileAccess(f, userPayload, 'write');

          return true;
        } catch {
          return false;
        }
      });

      if (allowed.length === 0) return { movedCount: 0 };

      return await this.fileLockService.withMultipleFileLocks(
        allowed.map(f => f.id),
        async () => {
          let moved = 0;

          for (const file of allowed) {
            const oldKey = file.objectKey.toString();
            const suffix = oldKey.substring(fromPrefix.length);
            const newKey = `${toPrefix}${suffix}`;

            if (oldKey === newKey) continue;

            // Extract new path and filename
            const idx = newKey.lastIndexOf('/');
            const newPath = idx >= 0 ? newKey.slice(0, idx) : '';
            const newFilename = idx >= 0 ? newKey.slice(idx + 1) : newKey;

            if (!file.status.isUploaded()) {
              file.move(newPath, newFilename);
              await this.fileRepository.update(file);
              this.publishAndClearDomainEvents(file);
            } else {
              await this.ensureDestinationAvailable(bucket, newKey, overwrite);
              await this.storageService.copyObject(bucket, oldKey, bucket, newKey);

              file.move(newPath, newFilename);
              await this.fileRepository.update(file);
              await this.storageService.deleteObject(bucket, oldKey);
              this.publishAndClearDomainEvents(file);
            }
            moved++;
          }

          return { movedCount: moved };
        },
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new StorageOperationFailedException('rename folder', errorMessage, {
        fromPrefix,
        toPrefix,
      });
    }
  }

  /** Delete folder (batch delete files with path prefix) */
  async deleteFolder(params: {
    pathPrefix: string;
    userId: string;
  }): Promise<{ deletedCount: number }> {
    const { pathPrefix, userId } = params;
    const bucket = this.configService.get<string>('storage.defaultBucket', 'nauto-console-dev');

    try {
      const files = await this.fileRepository.findByBucketAndPrefix(bucket, pathPrefix);
      const userPayload = { sub: userId };

      const allowed = files.filter(f => {
        try {
          this.fileAccessControlService.validateFileAccess(f, userPayload, 'delete');

          return true;
        } catch {
          return false;
        }
      });

      if (allowed.length === 0) return { deletedCount: 0 };

      return await this.fileLockService.withMultipleFileLocks(
        allowed.map(f => f.id),
        async () => {
          // Delete from storage (uploaded files only)
          const uploadedKeys = allowed
            .filter(f => f.status.isUploaded())
            .map(f => f.objectKey.toString());

          if (uploadedKeys.length) {
            await this.storageService.deleteObjects(bucket, uploadedKeys);
          }

          // Mark all as deleted in database
          for (const file of allowed) {
            file.markAsDeleted();
            await this.fileRepository.update(file);
            this.publishAndClearDomainEvents(file);
          }

          return { deletedCount: allowed.length };
        },
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new StorageOperationFailedException('delete folder', errorMessage, { pathPrefix });
    }
  }

  private async checkFolderExistence(bucket: string, storagePath: string): Promise<boolean> {
    try {
      // Check if folder exists physically (exact match)
      const folderExists = await this.storageService.folderExists(bucket, storagePath);
      if (folderExists) {
        return true;
      }

      // Check if there are any files in this path or subfolders in database
      const dbFiles = await this.fileRepository.findByBucketAndPrefix(bucket, storagePath);
      if (dbFiles.length > 0) {
        return true;
      }

      // Check if there are any physical files in this path or subfolders
      const folderPrefix = storagePath.endsWith('/') ? storagePath : `${storagePath}/`;
      const physicalFiles = await this.storageService.listObjectsByPrefix(bucket, folderPrefix);

      return physicalFiles.length > 0;
    } catch (_error) {
      return false;
    }
  }
}
