import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventBus } from '@nestjs/cqrs';

import { IFileRepository } from '@core/repositories/file.repository.interface';
import { IUserStorageConfigRepository } from '@core/repositories/user-storage-config.repository.interface';
import { IStorageService, ICompletedPart } from '@core/repositories/storage.service.interface';
import { IConcurrencyService } from '@core/repositories/concurrency.service.interface';
import { ILogger } from '@core/interfaces/logger.interface';
import { FileQuotaService } from './file-quota.service';
import { FileUploadValidationService } from './file-upload-validation.service';
import { FileNamingService } from './file-naming.service';

import { File } from '@core/entities/file.entity';
import { UserId } from '@core/value-objects/user-id.vo';

import {
  StorageQuotaExceededException,
  ConcurrencyLimitExceededException,
  UploadNotFoundException,
  UploadAlreadyCompletedException,
  UploadFailedException,
  InvalidPartNumberException,
} from '@core/exceptions/storage-domain.exceptions';

import {
  FILE_REPOSITORY,
  USER_STORAGE_CONFIG_REPOSITORY,
  STORAGE_SERVICE,
  CONCURRENCY_SERVICE,
  LOGGER_SERVICE,
} from '@shared/constants/tokens';

export interface IInitiateUploadParams {
  bucket: string;
  storagePath: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  userId: string;
  companyId: string;
}

export interface IInitiateUploadResult {
  fileId: string;
  uploadId: string;
  objectKey: string;
}

export interface IGeneratePartUrlResult {
  url: string;
  partNumber: number;
  expirationSeconds: number;
}

@Injectable()
export class MultipartUploadService {
  constructor(
    @Inject(FILE_REPOSITORY)
    private readonly fileRepository: IFileRepository,

    @Inject(USER_STORAGE_CONFIG_REPOSITORY)
    private readonly userStorageConfigRepository: IUserStorageConfigRepository,

    @Inject(STORAGE_SERVICE)
    private readonly storageService: IStorageService,

    @Inject(CONCURRENCY_SERVICE)
    private readonly concurrencyService: IConcurrencyService,

    @Inject(LOGGER_SERVICE)
    private readonly logger: ILogger,

    private readonly fileNamingService: FileNamingService,

    private readonly configService: ConfigService,
    private readonly eventBus: EventBus,
    private readonly fileQuotaService: FileQuotaService,
    private readonly fileUploadValidationService: FileUploadValidationService,
  ) {}

  /**
   * Initiates a multipart upload with comprehensive validation
   */
  async initiateUpload(params: IInitiateUploadParams): Promise<IInitiateUploadResult> {
    const { bucket, storagePath, filename, originalName, mimeType, size, userId } = params;

    // Ensure intermediate directories exist in storage
    await this.createIntermediateDirectories(bucket, storagePath);

    // 1) Centralized validation (MIME/ext, space preflight, concurrency by domain)
    await this.fileUploadValidationService.validateFileUploadOrThrow({
      userId,
      filename,
      mimeType,
      size,
    });

    // 2) Reserve quota atomically (includes existing reservations in the check)
    const quotaCheck = await this.fileQuotaService.checkAndReserveQuota(userId, size);
    if (!quotaCheck.allowed) {
      throw new StorageQuotaExceededException(
        userId,
        quotaCheck.currentUsage,
        size,
        quotaCheck.maxQuota,
      );
    }

    // 3) Acquire a concurrency slot (TTL configurable)
    const globalMaxConcurrent =
      this.configService.get<number>('storage.concurrency.globalMaxSimultaneousFiles', 5) ?? 5;

    const userConfig = await this.userStorageConfigRepository.findByUserIdWithTier(
      UserId.create(userId),
    );
    if (!userConfig) {
      // Release reservation if config missing (shouldn't happen due to validation, but safe)
      await this.fileQuotaService.releaseReservedQuota(userId, size).catch(() => {});
      throw new ConcurrencyLimitExceededException(userId, globalMaxConcurrent);
    }

    const userMaxConcurrent = Math.min(globalMaxConcurrent, userConfig.maxSimultaneousFiles);
    const slotTtl = this.configService.get<number>('storage.concurrency.slotTtlSec', 7200) ?? 7200;

    const slotResult = await this.concurrencyService.tryAcquireSlot(
      userId,
      userMaxConcurrent,
      slotTtl,
    );
    if (!slotResult.acquired) {
      await this.fileQuotaService.releaseReservedQuota(userId, size).catch(() => {});
      throw new ConcurrencyLimitExceededException(userId, userMaxConcurrent);
    }

    let savedFile: File | null = null;

    try {
      // 4) Generate unique filename to handle conflicts (like Dropbox)
      const uniqueFileResult = await this.fileNamingService.generateUniqueFileName(
        filename,
        storagePath,
        bucket,
      );

      // 5) Create and persist file aggregate in "pending"
      // Files in common areas (products/marketing) are public, user files are private
      const isPublic = storagePath.includes('/common/');

      const file = File.createForUpload(
        uniqueFileResult.filename,
        originalName,
        storagePath,
        uniqueFileResult.objectKey,
        mimeType,
        size,
        bucket,
        userId,
        isPublic,
      );
      savedFile = await this.fileRepository.save(file);

      // 5) Initiate multipart upload in storage
      const { uploadId } = await this.storageService.initiateMultipartUpload(
        bucket,
        savedFile.objectKey.toString(),
        mimeType,
      );

      // 6) Transition aggregate to "uploading" with uploadId
      savedFile.initiateUpload(uploadId);
      await this.fileRepository.update(savedFile);
      this.publishAndClearDomainEvents(savedFile);

      return {
        fileId: savedFile.id,
        uploadId,
        objectKey: savedFile.objectKey.toString(),
      };
    } catch (error) {
      // Compensation: release slot + quota
      await Promise.allSettled([
        this.concurrencyService.releaseSlot(userId),
        this.fileQuotaService.releaseReservedQuota(userId, size),
      ]);

      // Best-effort: mark aggregate as failed if it was already saved
      try {
        if (savedFile) {
          savedFile.failUpload(error instanceof Error ? error.message : 'init failed');
          await this.fileRepository.update(savedFile);
          this.publishAndClearDomainEvents(savedFile);
        }
      } catch {}

      throw error;
    }
  }

  /**
   * Generates a presigned URL for uploading a specific part
   */
  async generatePartUrl(
    fileId: string,
    partNumber: number,
    expirationSeconds?: number,
  ): Promise<IGeneratePartUrlResult> {
    if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > 10_000) {
      throw new InvalidPartNumberException(partNumber);
    }

    const file = await this.fileRepository.findById(fileId);
    if (!file) throw new UploadNotFoundException(fileId);

    if (!file.isUploading()) {
      throw new UploadAlreadyCompletedException(fileId);
    }

    const expiry =
      expirationSeconds ??
      this.configService.get<number>('storage.presign.expirySec', 3600) ??
      3600;

    const { url } = await this.storageService.generatePresignedPartUrl(
      file.bucket,
      file.objectKey.toString(),
      file.getUploadIdString()!,
      partNumber,
      expiry,
    );

    return { url, partNumber, expirationSeconds: expiry };
  }

  /**
   * Completes a multipart upload
   */
  async completeUpload(userId: string, fileId: string, parts: ICompletedPart[]): Promise<void> {
    const file = await this.fileRepository.findById(fileId);
    if (!file) throw new UploadNotFoundException(fileId);
    if (!file.isUploading()) throw new UploadAlreadyCompletedException(fileId);

    // Validate parts: sorted, no duplicates, all with ETag
    const sorted = parts.slice().sort((a, b) => a.PartNumber - b.PartNumber);
    for (let i = 0; i < sorted.length; i++) {
      const p = sorted[i];
      if (!Number.isInteger(p.PartNumber) || p.PartNumber < 1 || p.PartNumber > 10_000) {
        throw new InvalidPartNumberException(p.PartNumber);
      }
      if (!p.ETag) {
        throw new UploadFailedException(fileId, `Missing ETag for part ${p.PartNumber}`);
      }
      if (i > 0 && sorted[i - 1].PartNumber === p.PartNumber) {
        throw new UploadFailedException(fileId, `Duplicate part number ${p.PartNumber}`);
      }
    }

    try {
      const { etag } = await this.storageService.completeMultipartUpload(
        file.bucket,
        file.objectKey.toString(),
        file.getUploadIdString()!,
        sorted,
      );

      file.completeUpload(etag);
      await this.fileRepository.update(file);

      // Finalize quota usage after successful upload
      await this.fileQuotaService.finalizeQuotaUsage(userId, file.getSizeInBytes());

      this.publishAndClearDomainEvents(file);
    } catch (error) {
      // Abort and mark failed (also frees quota and releases slot)
      await this.abortUpload(userId, fileId, 'Upload completion failed');
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new UploadFailedException(fileId, errorMessage);
    } finally {
      // Always release slot (idempotent)
      await this.concurrencyService.releaseSlot(userId).catch(() => {});
    }
  }

  /**
   * Aborts a multipart upload
   */
  async abortUpload(userId: string, fileId: string, reason?: string): Promise<void> {
    const file = await this.fileRepository.findById(fileId);
    if (!file) return; // idempotent

    if (file.isUploading() && file.getUploadIdString()) {
      try {
        await this.storageService.abortMultipartUpload(
          file.bucket,
          file.objectKey.toString(),
          file.getUploadIdString()!,
        );
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(`Failed to abort multipart upload: ${errorMessage} (fileId: ${fileId})`);
      }
    }

    file.failUpload(reason || 'Upload aborted');
    await this.fileRepository.update(file);
    this.publishAndClearDomainEvents(file);

    await Promise.allSettled([
      this.fileQuotaService.releaseReservedQuota(userId, file.getSizeInBytes()),
      this.concurrencyService.releaseSlot(userId),
    ]);
  }

  /**
   * Gets upload status for a file
   */
  async getUploadStatus(fileId: string): Promise<{
    fileId: string;
    status: string;
    uploadId: string | null;
    objectKey: string;
    size: number;
    uploadedAt?: Date;
  } | null> {
    const file = await this.fileRepository.findById(fileId);
    if (!file) return null;

    return {
      fileId: file.id,
      status: file.status.getValue(),
      uploadId: file.getUploadIdString(),
      objectKey: file.objectKey.toString(),
      size: file.getSizeInBytes(),
      uploadedAt: file.status.isUploaded() ? file.updatedAt : undefined,
    };
  }

  /**
   * Heartbeat to keep upload alive and detect disconnected clients
   */
  async heartbeat(fileId: string, userId: string): Promise<void> {
    const file = await this.fileRepository.findById(fileId);
    if (!file) {
      throw new UploadNotFoundException(fileId);
    }

    // Verify user ownership
    if (file.userId !== userId) {
      throw new UploadNotFoundException(fileId);
    }

    if (!file.isUploading()) {
      throw new UploadAlreadyCompletedException(fileId);
    }

    // Update last activity timestamp
    file.updateLastActivity();
    await this.fileRepository.update(file);

    // Extend concurrency slot TTL
    const slotTtl = this.configService.get<number>('storage.concurrency.slotTtlSec', 7200) ?? 7200;
    await this.concurrencyService.heartbeat(userId, slotTtl);

    this.logger.debug({
      message: 'Upload heartbeat processed',
      fileId,
      userId,
    });
  }

  /**
   * Cleanup expired uploads
   */
  async cleanupExpiredUploads(olderThanMinutes: number = 120): Promise<number> {
    const expiredFiles = await this.fileRepository.findExpiredUploads(olderThanMinutes);
    let cleanedCount = 0;

    for (const file of expiredFiles) {
      try {
        if (file.getUploadIdString()) {
          await this.storageService.abortMultipartUpload(
            file.bucket,
            file.objectKey.toString(),
            file.getUploadIdString()!,
          );
        }

        file.failUpload('Upload expired');
        await this.fileRepository.update(file);
        this.publishAndClearDomainEvents(file);

        if (file.userId) {
          await Promise.allSettled([
            this.concurrencyService.releaseSlot(file.userId),
            this.fileQuotaService.releaseReservedQuota(file.userId, file.getSizeInBytes()),
          ]);
        }

        cleanedCount++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(`Failed to cleanup expired upload ${file.id}: ${errorMessage}`);
      }
    }

    return cleanedCount;
  }

  // ---------- helpers ----------

  private publishAndClearDomainEvents(file: File) {
    const events = file.getDomainEvents?.();
    for (const e of events) this.eventBus.publish(e);
    file.clearDomainEvents?.();
  }

  private extractFileExtension(filename: string): string {
    const parts = filename.split('.');

    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
  }

  private async createIntermediateDirectories(bucket: string, storagePath: string): Promise<void> {
    const cleanPath = storagePath.replace(/^\/+|\/+$/g, '');
    if (cleanPath === '') {
      return;
    }

    const segments = cleanPath.split('/').filter(segment => segment.length > 0);

    for (let i = 1; i <= segments.length; i++) {
      const currentPath = segments.slice(0, i).join('/');
      await this.storageService.createFolder(bucket, currentPath);
    }
  }
}
