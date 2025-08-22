import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventBus } from '@nestjs/cqrs';

import { IFileRepository } from '@core/repositories/file.repository.interface';
import { IStorageService } from '@core/repositories/storage.service.interface';

import { File } from '@core/entities/file.entity';
import { ObjectKey } from '@core/value-objects/object-key.vo';

import {
  StorageOperationFailedException,
  InvalidPathException,
} from '@core/exceptions/storage-domain.exceptions';
import {
  EntityNotFoundException,
  InvalidFileOperationException,
} from '@core/exceptions/domain-exceptions';
import { FileLockService } from './file-lock.service';
import { FileAccessControlService } from './file-access-control.service';

import { FILE_REPOSITORY, STORAGE_SERVICE } from '@shared/constants/tokens';

export interface IMoveFileParams {
  fileId: string;
  newPath: string;
  userId?: string; // For access control
  /** Evita error si el destino ya existe */
  overwrite?: boolean;
}

export interface IRenameFileParams {
  fileId: string;
  newFilename: string;
  userId?: string; // For access control
  overwrite?: boolean;
}

export interface IDeleteFileParams {
  fileId: string;
  userId?: string; // For access control
  hardDelete?: boolean; // Physical deletion vs soft delete
}

export interface ISetVisibilityParams {
  fileId: string;
  isPublic: boolean;
  userId?: string; // For access control
}

export interface IGenerateSignedUrlParams {
  fileId: string;
  expirationSeconds?: number;
  userId?: string; // For access control
}

export interface IFolderOperationParams {
  bucket: string;
  path: string;
  userId?: string; // For access control
}

@Injectable()
export class FileOperationsService {
  private readonly MOVE_COPY_CONCURRENCY = 8;

  constructor(
    @Inject(FILE_REPOSITORY)
    private readonly fileRepository: IFileRepository,

    @Inject(STORAGE_SERVICE)
    private readonly storageService: IStorageService,

    private readonly configService: ConfigService,
    private readonly eventBus: EventBus,
    private readonly fileLockService: FileLockService,
    private readonly fileAccessControlService: FileAccessControlService,
  ) {}

  // ---------------------------
  // Helpers
  // ---------------------------

  private assertSafePath(path: string, fileId: string, op: string) {
    if (
      !path ||
      path.includes('\0') ||
      path.startsWith('/') ||
      path.includes('\\') ||
      path.split('/').some(seg => seg === '..')
    ) {
      throw new InvalidFileOperationException(op, 'Invalid path format', fileId);
    }
  }

  private assertSafeFilename(name: string, fileId: string, op: string) {
    if (!name || name.includes('\0') || name.includes('/') || name.includes('\\')) {
      throw new InvalidFileOperationException(op, 'Invalid filename format', fileId);
    }
  }

  private publishAndClearDomainEvents(file: File) {
    const events = file.getDomainEvents?.();
    for (const e of events) this.eventBus.publish(e);
    file.clearDomainEvents?.();
  }

  private async ensureDestinationAvailable(
    bucket: string,
    destKey: string,
    overwrite?: boolean,
    conflictMsg = 'Destination object already exists',
  ) {
    const exists = await this.storageService.objectExists(bucket, destKey);
    if (exists && !overwrite) {
      throw new InvalidFileOperationException('copy/move', conflictMsg, destKey);
    }
  }

  // ---------------------------
  // File ops (con lock por archivo)
  // ---------------------------

  /** Move file */
  async moveFile(params: IMoveFileParams): Promise<File> {
    const { fileId } = params;

    return this.fileLockService.withFileLock(fileId, () => this.performMoveFile(params));
  }

  private async performMoveFile(params: IMoveFileParams): Promise<File> {
    const { fileId, newPath, userId, overwrite } = params;

    this.assertSafePath(newPath, fileId, 'move file');

    const file = await this.fileRepository.findById(fileId);
    if (!file) throw new EntityNotFoundException('File', fileId);

    const userPayload = userId ? { sub: userId } : null;
    this.fileAccessControlService.validateFileAccess(file, userPayload, 'write');

    if (!file.canBeMoved()) {
      throw new InvalidFileOperationException(
        'move file',
        'File must be uploaded or pending',
        fileId,
      );
    }

    const oldKey = file.objectKey.toString();
    const newKey = ObjectKey.join(newPath, file.filename).toString();
    if (oldKey === newKey) return file;

    // Si el archivo aún no está subido, solo ajusta metadatos en BD
    if (!file.status.isUploaded()) {
      file.move(newPath);
      const updated = await this.fileRepository.update(file);
      this.publishAndClearDomainEvents(file);

      return updated;
    }

    await this.ensureDestinationAvailable(
      file.bucket,
      newKey,
      overwrite,
      'Target path already contains a file',
    );

    try {
      await this.storageService.copyObject(file.bucket, oldKey, file.bucket, newKey);
      try {
        file.move(newPath);
        const updated = await this.fileRepository.update(file);
        await this.storageService.deleteObject(file.bucket, oldKey);
        this.publishAndClearDomainEvents(file);

        return updated;
      } catch (dbErr) {
        // rollback best-effort: devolver al key original
        await this.storageService
          .copyObject(file.bucket, newKey, file.bucket, oldKey)
          .catch(() => undefined);
        await this.storageService.deleteObject(file.bucket, newKey).catch(() => undefined);
        throw dbErr;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new StorageOperationFailedException('move file', errorMessage, {
        fileId,
        oldPath: file.path,
        newPath,
      });
    }
  }

  /** Rename file */
  async renameFile(params: IRenameFileParams): Promise<File> {
    const { fileId } = params;

    return this.fileLockService.withFileLock(fileId, () => this.performRenameFile(params));
  }

  private async performRenameFile(params: IRenameFileParams): Promise<File> {
    const { fileId, newFilename, userId, overwrite } = params;

    const file = await this.fileRepository.findById(fileId);
    if (!file) throw new EntityNotFoundException('File', fileId);

    const userPayload = userId ? { sub: userId } : null;
    this.fileAccessControlService.validateFileAccess(file, userPayload, 'write');

    if (!file.canBeRenamed()) {
      throw new InvalidFileOperationException(
        'rename file',
        'File must be uploaded or pending',
        fileId,
      );
    }

    this.assertSafeFilename(newFilename, fileId, 'rename file');

    const oldKey = file.objectKey.toString();
    const newKey = ObjectKey.join(file.path, newFilename).toString();
    if (oldKey === newKey) return file;

    if (!file.status.isUploaded()) {
      file.move(file.path, newFilename);
      const updated = await this.fileRepository.update(file);
      this.publishAndClearDomainEvents(file);

      return updated;
    }

    await this.ensureDestinationAvailable(
      file.bucket,
      newKey,
      overwrite,
      'A file with the new name already exists',
    );

    try {
      await this.storageService.copyObject(file.bucket, oldKey, file.bucket, newKey);
      try {
        file.move(file.path, newFilename);
        const updated = await this.fileRepository.update(file);
        await this.storageService.deleteObject(file.bucket, oldKey);
        this.publishAndClearDomainEvents(file);

        return updated;
      } catch (dbErr) {
        await this.storageService
          .copyObject(file.bucket, newKey, file.bucket, oldKey)
          .catch(() => undefined);
        await this.storageService.deleteObject(file.bucket, newKey).catch(() => undefined);
        throw dbErr;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new StorageOperationFailedException('rename file', errorMessage, {
        fileId,
        oldFilename: file.filename,
        newFilename,
      });
    }
  }

  /** Delete file */
  async deleteFile(params: IDeleteFileParams): Promise<void> {
    const { fileId } = params;

    return this.fileLockService.withFileLock(fileId, () => this.performDeleteFile(params));
  }

  private async performDeleteFile(params: IDeleteFileParams): Promise<void> {
    const { fileId, userId, hardDelete = false } = params;

    const file = await this.fileRepository.findById(fileId);
    if (!file) throw new EntityNotFoundException('File', fileId);

    const userPayload = userId ? { sub: userId } : null;
    this.fileAccessControlService.validateFileAccess(file, userPayload, 'delete');

    if (!file.canBeDeleted()) {
      throw new InvalidFileOperationException(
        'delete file',
        'Cannot delete file while uploading',
        fileId,
      );
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
      throw new StorageOperationFailedException('delete file', errorMessage, {
        fileId,
        hardDelete,
      });
    }
  }

  /** Set visibility */
  async setFileVisibility(params: ISetVisibilityParams): Promise<File> {
    const { fileId } = params;

    return this.fileLockService.withFileLock(fileId, () => this.performSetFileVisibility(params));
  }

  private async performSetFileVisibility(params: ISetVisibilityParams): Promise<File> {
    const { fileId, isPublic, userId } = params;

    const file = await this.fileRepository.findById(fileId);
    if (!file) throw new EntityNotFoundException('File', fileId);

    const userPayload = userId ? { sub: userId } : null;
    this.fileAccessControlService.validateFileAccess(file, userPayload, 'write');

    if (!file.status.isUploaded()) {
      throw new InvalidFileOperationException(
        'set file visibility',
        'File must be uploaded',
        fileId,
      );
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
      throw new StorageOperationFailedException('set file visibility', errorMessage, {
        fileId,
        isPublic,
      });
    }
  }

  /** Generate signed URL */
  async generateSignedUrl(params: IGenerateSignedUrlParams): Promise<string> {
    const { fileId, expirationSeconds, userId } = params;

    const file = await this.fileRepository.findById(fileId);
    if (!file) throw new EntityNotFoundException('File', fileId);

    const userPayload = userId ? { sub: userId } : null;
    this.fileAccessControlService.validateFileAccess(file, userPayload, 'read');

    if (!file.status.isUploaded()) {
      throw new InvalidFileOperationException(
        'generate signed URL',
        'File must be uploaded',
        fileId,
      );
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
      throw new StorageOperationFailedException('generate signed URL', errorMessage, {
        fileId,
        expirationSeconds,
      });
    }
  }

  // ---------------------------
  // Folder ops (con locks múltiples y permisos por archivo)
  // ---------------------------

  /** Create virtual folder (validate path only) */
  async createFolder(params: IFolderOperationParams): Promise<{ path: string }> {
    const { path } = params;

    try {
      ObjectKey.create(`${path}/placeholder`);
    } catch {
      throw new InvalidPathException(path, 'Invalid folder path');
    }

    const normalizedPath = path.replace(/^\/+|\/+$/g, '');

    return { path: normalizedPath };
  }

  /** Rename/move folder (prefix) */
  async renameFolder(params: {
    bucket: string;
    fromPrefix: string;
    toPrefix: string;
    userId?: string;
    overwrite?: boolean;
  }): Promise<{ movedCount: number }> {
    const { bucket, fromPrefix, toPrefix, userId, overwrite } = params;

    try {
      const files = await this.fileRepository.findByBucketAndPrefix(bucket, fromPrefix);

      const userPayload = userId ? { sub: userId } : null;
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

          const work = allowed.map(f => async () => {
            const oldKey = f.objectKey.toString();
            const suffix = oldKey.substring(fromPrefix.length);
            const newKey = `${toPrefix}${suffix}`;

            if (oldKey === newKey) return;

            if (!f.status.isUploaded()) {
              // solo BD
              const idx = newKey.lastIndexOf('/');
              const newPath = idx >= 0 ? newKey.slice(0, idx) : '';
              const newName = idx >= 0 ? newKey.slice(idx + 1) : newKey;
              f.move(newPath, newName);
              await this.fileRepository.update(f);
              this.publishAndClearDomainEvents(f);
              moved++;

              return;
            }

            await this.ensureDestinationAvailable(bucket, newKey, overwrite);

            await this.storageService.copyObject(bucket, oldKey, bucket, newKey);
            try {
              const idx = newKey.lastIndexOf('/');
              const newPath = idx >= 0 ? newKey.slice(0, idx) : '';
              const newName = idx >= 0 ? newKey.slice(idx + 1) : newKey;

              f.move(newPath, newName);
              await this.fileRepository.update(f);
              await this.storageService.deleteObject(bucket, oldKey);
              this.publishAndClearDomainEvents(f);
              moved++;
            } catch (dbErr) {
              await this.storageService
                .copyObject(bucket, newKey, bucket, oldKey)
                .catch(() => undefined);
              await this.storageService.deleteObject(bucket, newKey).catch(() => undefined);
              throw dbErr;
            }
          });

          // Concurrencia limitada
          let i = 0;
          const runners = Array.from(
            { length: Math.min(this.MOVE_COPY_CONCURRENCY, work.length) },
            async () => {
              while (i < work.length) {
                const idx = i++;
                await work[idx]();
              }
            },
          );
          await Promise.all(runners);

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

  /** Delete folder (prefix) */
  async deleteFolder(params: IFolderOperationParams): Promise<{ deletedCount: number }> {
    const { bucket, path, userId } = params;

    try {
      const files = await this.fileRepository.findByBucketAndPrefix(bucket, path);

      const userPayload = userId ? { sub: userId } : null;
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
          // elimina en storage solo los subidos
          const uploadedKeys = allowed
            .filter(f => f.status.isUploaded())
            .map(f => f.objectKey.toString());
          if (uploadedKeys.length) {
            await this.storageService.deleteObjects(bucket, uploadedKeys);
          }

          // marca todos los permitidos como deleted en BD
          let deleted = 0;
          for (const f of allowed) {
            f.markAsDeleted();
            await this.fileRepository.update(f);
            this.publishAndClearDomainEvents(f);
            deleted++;
          }

          return { deletedCount: deleted };
        },
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new StorageOperationFailedException('delete folder', errorMessage, { bucket, path });
    }
  }
}
