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
import { FileLockService } from './file-lock.service';
import { TransactionService } from '@infrastructure/database/prisma/transaction.service';

import { File } from '@core/entities/file.entity';
import { UserId } from '@core/value-objects/user-id.vo';

import {
  StorageQuotaExceededException,
  ConcurrencyLimitExceededException,
  UploadNotFoundException,
  UploadAlreadyCompletedException,
  UploadFailedException,
  InvalidPartNumberException,
  InvalidFileStateException,
  UploadExpiredException,
  DuplicatePathUploadException,
  AppFileSizeLimitExceededException,
} from '@core/exceptions/storage-domain.exceptions';
import { InvalidFileOperationException } from '@core/exceptions/domain-exceptions';

import {
  FILE_REPOSITORY,
  USER_STORAGE_CONFIG_REPOSITORY,
  STORAGE_SERVICE,
  CONCURRENCY_SERVICE,
  LOGGER_SERVICE,
} from '@shared/constants/tokens';
import { FileStatus } from '@shared/constants/file-status.enum';
import { TargetAppsEnum } from '@shared/constants/target-apps.enum';
import {
  IAllowedFileConfig,
  isValidFileSizeForStorageApp,
} from '@core/entities/user-storage-config.entity';

export interface IInitiateUploadParams {
  bucket: string;
  storagePath: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  userId: string;
  companyId: string;
  upsert?: boolean;
  autoRename?: boolean;
  targetApps?: string[];
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
    private readonly fileLockService: FileLockService,
    private readonly transactionService: TransactionService,
  ) {}

  /**
   * Initiates a multipart upload with comprehensive validation
   */
  async initiateUpload(
    params: IInitiateUploadParams,
    useLock: boolean,
  ): Promise<IInitiateUploadResult> {
    const { filename, mimeType, size, userId } = params;

    // 1) Centralized validation (MIME/ext, space preflight, concurrency by domain)
    await this.fileUploadValidationService.validateFileUploadOrThrow({
      userId,
      filename,
      mimeType,
      size,
    });

    // 1.5) App-specific validation if targetApps specified
    if (params.targetApps && params.targetApps.length > 0) {
      await this.validateAppSpecificRequirements(params.targetApps, filename, size, userId);
    }

    // 2) Execute with or without user lock based on parameter
    if (useLock) {
      return this.fileLockService.withUserLock(userId, () => this.executeInitiateUpload(params));
    } else {
      return this.executeInitiateUpload(params);
    }
  }

  /**
   * Internal method that executes the initiate upload logic without locks
   */
  private async executeInitiateUpload(
    params: IInitiateUploadParams,
  ): Promise<IInitiateUploadResult> {
    const {
      bucket,
      storagePath,
      filename,
      originalName,
      mimeType,
      size,
      userId,
      upsert = false,
      autoRename = false,
      targetApps = [],
    } = params;

    // 1. Check for duplicate path uploads and handle auto-rename
    let finalFilename = filename;
    if (autoRename) {
      finalFilename = await this.resolveUniqueFilename(bucket, storagePath, filename);
    } else {
      await this.validateDuplicatePathUpload(bucket, storagePath, filename, upsert);
    }

    // Reserve quota atomically (includes existing reservations in the check)
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
      try {
        const result = await this.fileQuotaService.releaseReservedQuota(userId, size);
        if (!result.success) {
          this.logger.warn(
            `Failed to release quota reservation during config missing cleanup: ${userId}`,
          );
        }
      } catch (error) {
        this.logger.error(
          `Error releasing quota reservation during config missing cleanup: ${error}`,
        );
      }
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
      try {
        const result = await this.fileQuotaService.releaseReservedQuota(userId, size);
        if (!result.success) {
          this.logger.warn(
            `Failed to release quota reservation during concurrency limit cleanup: ${userId}`,
          );
        }
      } catch (error) {
        this.logger.error(`Error releasing quota reservation: ${error}`);
      }
      throw new ConcurrencyLimitExceededException(userId, userMaxConcurrent);
    }

    let savedFile: File | null = null;

    try {
      // Ensure intermediate directories exist in storage
      await this.createIntermediateDirectories(params.bucket, params.storagePath);

      // 4) Generate unique filename to handle conflicts (like Dropbox) - only if not already resolved via autoRename
      const uniqueFileResult = autoRename
        ? { filename: finalFilename, objectKey: `${storagePath}/${finalFilename}` }
        : await this.fileNamingService.generateUniqueFileName(finalFilename, storagePath, bucket);

      // 5) Create and persist file aggregate in "pending"
      // Files in common areas (products/marketing) are public, user files are private
      const isPublic = storagePath.startsWith(`${params.companyId}/common/`);

      // Get current storage driver from config
      const storageDriver = this.configService.get<string>('storage.provider', 'minio');

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
        targetApps,
        storageDriver,
      );
      savedFile = await this.fileRepository.save(file);

      // 5) Initiate multipart upload in storage
      const { uploadId } = await this.storageService.initiateMultipartUpload(
        bucket,
        savedFile.objectKey.toString(),
        mimeType,
        size,
        isPublic,
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
      const cleanupResults = await Promise.allSettled([
        this.concurrencyService.releaseSlot(userId),
        this.fileQuotaService.releaseReservedQuota(userId, size),
      ]);

      // Log any cleanup failures
      cleanupResults.forEach((result, index) => {
        if (result.status === 'rejected') {
          const operation = index === 0 ? 'release concurrency slot' : 'release quota reservation';
          this.logger.warn(
            `Failed to ${operation} during initiate upload cleanup: ${result.reason}`,
          );
        } else if (index === 1) {
          // Check quota release success
          const quotaResult = result.value;
          if (
            typeof quotaResult === 'object' &&
            quotaResult &&
            'success' in quotaResult &&
            !quotaResult.success
          ) {
            this.logger.warn(
              `Quota release was unsuccessful during initiate upload cleanup for user ${userId}`,
            );
          }
        }
      });

      // Best-effort: delete failed record from database to avoid objectKey conflicts
      try {
        if (savedFile) {
          const reason = error instanceof Error ? error.message : 'init failed';
          this.logger.warn(
            `Deleting failed file record ${savedFile.id} due to init failure: ${reason}`,
          );
          await this.fileRepository.delete(savedFile.id);
        }
      } catch (deleteError) {
        this.logger.error(`Failed to delete failed file record: ${deleteError}`);
      }

      throw error;
    }
  }

  /**
   * Generates a presigned URL for uploading a specific part
   */
  async generatePartUrl(
    declaredPartSizeBytes: number,
    fileId: string,
    partNumber: number,
    expirationSeconds?: number,
  ): Promise<IGeneratePartUrlResult> {
    if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > 10_000) {
      throw new InvalidPartNumberException(partNumber);
    }

    const file = await this.fileRepository.findById(fileId);
    if (!file) throw new UploadNotFoundException(fileId);

    // Check if upload is expired before allowing operations
    if (this.isUploadExpired(file)) {
      throw new UploadExpiredException(fileId, 15);
    }

    // Comprehensive status validation
    if (file.status.isUploaded()) {
      throw new UploadAlreadyCompletedException(fileId);
    }

    if (file.status.isCopying() || file.status.isProcessing()) {
      throw new InvalidFileStateException(
        fileId,
        file.status.toString(),
        FileStatus.UPLOADING,
        'generate part URL - file is busy',
      );
    }

    // Only UPLOADING status is valid for completion
    if (!file.status.isUploading()) {
      throw new InvalidFileStateException(
        fileId,
        file.status.toString(),
        FileStatus.UPLOADING,
        'generate part URL',
      );
    }

    const expiry =
      expirationSeconds ??
      this.configService.get<number>('storage.presign.expirySec', 3600) ??
      3600;

    return await this.fileLockService.withFileLock(fileId, async () => {
      const { url } = await this.storageService.generatePresignedPartUrl(
        file.bucket,
        file.objectKey.toString(),
        file.getUploadIdString()!,
        partNumber,
        expiry,
        declaredPartSizeBytes,
        file.size.getBytes(),
      );

      return { url, partNumber, expirationSeconds: expiry };
    });
  }

  /**
   * Completes a multipart upload
   */
  async completeUpload(
    userId: string,
    fileId: string,
    parts: ICompletedPart[],
    useLock: boolean,
  ): Promise<void> {
    if (useLock) {
      return this.fileLockService.withFileLock(fileId, () =>
        this.executeCompleteUpload(userId, fileId, parts),
      );
    } else {
      return this.executeCompleteUpload(userId, fileId, parts);
    }
  }

  /**
   * Internal method that executes the complete upload logic without locks
   */
  private async executeCompleteUpload(
    userId: string,
    fileId: string,
    parts: ICompletedPart[],
  ): Promise<void> {
    const file = await this.fileRepository.findById(fileId);
    if (!file) throw new UploadNotFoundException(fileId);

    // Check if upload is expired before allowing completion
    if (this.isUploadExpired(file)) {
      throw new UploadExpiredException(fileId, 15);
    }

    // Comprehensive status validation
    if (file.status.isUploaded()) {
      throw new UploadAlreadyCompletedException(fileId);
    }

    if (file.status.isCopying() || file.status.isProcessing()) {
      throw new InvalidFileStateException(
        fileId,
        file.status.toString(),
        FileStatus.UPLOADING,
        'complete upload - file is busy',
      );
    }

    // Only UPLOADING status is valid for completion
    if (!file.status.isUploading()) {
      throw new InvalidFileStateException(
        fileId,
        file.status.toString(),
        FileStatus.UPLOADING,
        'complete upload',
      );
    }

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

    // Validate that all parts are properly processed (requirement 2)
    await this.validateAllPartsProcessed(file, sorted);

    try {
      const { etag } = await this.storageService.completeMultipartUpload(
        file.bucket,
        file.objectKey.toString(),
        file.getUploadIdString()!,
        sorted,
        file.size.getBytes(),
      );

      file.completeUpload(etag);
      await this.fileRepository.update(file);

      // Set object access level based on file visibility after successful upload
      try {
        if (file.isPublic) {
          await this.storageService.setObjectPublic(file.bucket, file.objectKey.toString());
          this.logger.log(`File ${file.id} set to public in storage`);
        } else {
          await this.storageService.setObjectPrivate(file.bucket, file.objectKey.toString());
          this.logger.log(`File ${file.id} set to private in storage`);
        }
      } catch (error) {
        // Log error but don't fail the upload - ACL is not critical for core functionality
        this.logger.warn(
          `Failed to set object ACL for file ${file.id}: ${error instanceof Error ? error.message : 'Unknown error'}. File uploaded successfully but ACL not applied.`,
        );
      }

      // Finalize quota usage after successful upload
      const quotaResult = await this.fileQuotaService.finalizeQuotaUsage(
        userId,
        file.getSizeInBytes(),
      );
      if (!quotaResult.success) {
        this.logger.error(
          `CRITICAL: Failed to finalize quota usage after successful upload - quota may be out of sync for user ${userId}, file ${fileId}`,
        );
      }

      this.publishAndClearDomainEvents(file);
    } catch (error) {
      // Abort and mark failed (also frees quota and releases slot)
      await this.abortUpload(userId, fileId, false, 'Upload completion failed');
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
  async abortUpload(
    userId: string,
    fileId: string,
    useLock: boolean,
    reason?: string,
  ): Promise<void> {
    if (useLock) {
      return this.fileLockService.withFileLock(fileId, () =>
        this.executeAbortUpload(userId, fileId, reason),
      );
    } else {
      return this.executeAbortUpload(userId, fileId, reason);
    }
  }

  /**
   * Internal method that executes the abort upload logic without locks
   * Uses transaction-per-file approach with rollback logic for consistency
   */
  private async executeAbortUpload(userId: string, fileId: string, reason?: string): Promise<void> {
    const file = await this.fileRepository.findById(fileId);
    if (!file) return; // idempotent

    // For abort operations, we allow expired files to be aborted (cleanup purpose)
    // But we'll log if it's expired to help with monitoring
    if (this.isUploadExpired(file)) {
      this.logger.warn(`Aborting expired upload: ${fileId} for user: ${userId}`);
    }

    // Cannot abort files that are not in uploading state
    if (!file.status.isUploading()) {
      throw new InvalidFileOperationException(
        'abort',
        `Cannot abort file in ${file.status.toString()} state. Only UPLOADING files can be aborted.`,
        fileId,
      );
    }

    const abortReason = reason || 'Upload aborted';

    // Execute abort operation within a transaction
    await this.transactionService.executeInTransaction(async _tx => {
      // Step 1: Delete file record from database first
      this.logger.log(`Deleting aborted file record ${fileId}: ${abortReason}`);
      await this.fileRepository.delete(fileId);

      // Step 2: Try to abort multipart upload in storage
      let storageAbortError: Error | null = null;

      if (file.getUploadIdString()) {
        try {
          await this.storageService.abortMultipartUpload(
            file.bucket,
            file.objectKey.toString(),
            file.getUploadIdString()!,
          );
          this.logger.log(`Successfully aborted multipart upload in storage (fileId: ${fileId})`);
        } catch (error) {
          storageAbortError = error instanceof Error ? error : new Error('Unknown storage error');

          // Check if object actually exists in storage
          let objectExists = true;
          try {
            objectExists = await this.storageService.objectExists(
              file.bucket,
              file.objectKey.toString(),
            );
          } catch (checkError) {
            this.logger.warn(
              `Failed to check object existence during abort cleanup: ${checkError}`,
            );
          }

          // If object exists in storage but we failed to abort, we need to rollback
          // to maintain consistency between DB and storage
          if (objectExists) {
            this.logger.error(
              `Storage abort failed and object exists - rolling back transaction to maintain consistency: ${storageAbortError.message} (fileId: ${fileId})`,
            );
            throw storageAbortError; // This will trigger transaction rollback
          } else {
            // Object doesn't exist in storage, so it's safe to proceed with DB deletion
            this.logger.warn(
              `Storage abort failed but object doesn't exist - proceeding with DB deletion: ${storageAbortError.message} (fileId: ${fileId})`,
            );
          }
        }
      }

      // If we reach here, either storage abort succeeded or object doesn't exist
      // Proceed with resource cleanup outside the transaction since DB operation is committed
    });

    // Step 3: Release resources after successful transaction commit
    // This is done outside the transaction to avoid unnecessary rollbacks due to quota/concurrency service issues
    const cleanupResults = await Promise.allSettled([
      this.fileQuotaService.releaseReservedQuota(userId, file.getSizeInBytes()),
      this.concurrencyService.releaseSlot(userId),
    ]);

    // Log cleanup results for monitoring
    cleanupResults.forEach((result, index) => {
      if (result.status === 'rejected') {
        const operation = index === 0 ? 'release quota reservation' : 'release concurrency slot';
        this.logger.warn(
          `Failed to ${operation} during abort cleanup for user ${userId}, file ${fileId}: ${result.reason}`,
        );
      } else if (index === 0) {
        // Check quota release success
        const quotaResult = result.value;
        if (typeof quotaResult === 'object' && quotaResult && 'success' in quotaResult) {
          if (!quotaResult.success) {
            this.logger.warn(
              `Quota release was unsuccessful during abort cleanup - potential quota leak for user ${userId}, file ${fileId}`,
            );
          } else {
            this.logger.log(
              `Successfully released quota reservation: ${file.getSizeInBytes()} bytes for user ${userId}`,
            );
          }
        }
      }
    });
  }

  /**
   * Checks if a file upload is expired based on same logic as StaleUploadsCleanupWorker
   * but with 1 minute buffer to avoid race conditions with the worker
   */
  isUploadExpired(file: File, thresholdMinutes: number = 15): boolean {
    if (!file.status.isUploading() && !file.status.isPending()) {
      return false; // Only UPLOADING or PENDING files can be expired
    }

    // Use same logic as worker but with 1 minute buffer
    const bufferMinutes = thresholdMinutes - 1;
    const expiredTime = new Date(Date.now() - bufferMinutes * 60 * 1000);

    return file.updatedAt < expiredTime;
  }

  /**
   * Resolves a unique filename when autoRename is enabled
   * Uses the FileNamingService to find a unique filename if conflicts exist
   */
  private async resolveUniqueFilename(
    bucket: string,
    storagePath: string,
    filename: string,
  ): Promise<string> {
    const existingFiles = await this.fileRepository.findByBucketPathAndFilename(
      bucket,
      storagePath,
      filename,
    );

    // No conflict, use original filename
    if (existingFiles.length === 0) {
      return filename;
    }

    // Check if there's any active upload conflict (PENDING, UPLOADING, COPYING, PROCESSING)
    const hasActiveConflict = existingFiles.some(
      file =>
        file.status.isPending() ||
        file.status.isUploading() ||
        file.status.isCopying() ||
        file.status.isProcessing(),
    );

    // Check if there's any uploaded file conflict
    const hasUploadedConflict = existingFiles.some(file => file.status.isUploaded());

    // If conflicts exist, generate a unique filename
    if (hasActiveConflict || hasUploadedConflict) {
      const uniqueResult = await this.fileNamingService.generateUniqueFileName(
        filename,
        storagePath,
        bucket,
      );

      return uniqueResult.filename;
    }

    return filename;
  }

  /**
   * Validates that no duplicate upload exists at the same path
   * Implements security requirement 1: prevent duplicate uploads at same full path
   */
  private async validateDuplicatePathUpload(
    bucket: string,
    storagePath: string,
    filename: string,
    upsert: boolean,
  ): Promise<void> {
    // Find existing files at the same full path (bucket + path + filename)
    const existingFiles = await this.fileRepository.findByBucketPathAndFilename(
      bucket,
      storagePath,
      filename,
    );

    if (existingFiles.length === 0) {
      return; // No conflict, allow upload
    }

    // Check for active status conflicts (requirement 1.1) - UPLOADING, PENDING, COPYING, PROCESSING
    const activeFile = existingFiles.find(
      file =>
        file.status.isUploading() ||
        file.status.isPending() ||
        file.status.isCopying() ||
        file.status.isProcessing(),
    );
    if (activeFile) {
      throw new DuplicatePathUploadException(
        `${storagePath}/${filename}`,
        activeFile.status.getValue(),
      );
    }

    // Check for UPLOADED status with upsert requirement (requirement 1.2)
    const uploadedFile = existingFiles.find(file => file.status.isUploaded());
    if (uploadedFile) {
      if (!upsert) {
        throw new DuplicatePathUploadException(
          `${storagePath}/${filename}`,
          uploadedFile.status.getValue(),
        );
      }
      // If upsert is true, we allow overwriting UPLOADED files
      // The old file will be handled during upload completion
    }

    // Allow uploads if no UPLOADING or UPLOADED conflicts found
  }

  /**
   * Validates that all parts are properly processed before completing upload
   * Implements security requirement 2: validate parts or file size
   */
  private async validateAllPartsProcessed(file: File, parts: ICompletedPart[]): Promise<void> {
    const fileId = file.id;

    try {
      // Try to get uploaded parts from storage service to validate they exist
      if (this.storageService.listUploadParts) {
        const partsResult = await this.storageService.listUploadParts(
          file.bucket,
          file.objectKey.toString(),
          file.getUploadIdString()!,
        );

        // Check if all provided parts exist in storage
        for (const part of parts) {
          const uploadedPart = partsResult.parts.find(p => p.PartNumber === part.PartNumber);
          if (!uploadedPart) {
            throw new UploadFailedException(
              fileId,
              `Part ${part.PartNumber} not found in storage - upload may be incomplete`,
            );
          }

          // Validate ETag matches (if available)
          if (uploadedPart.ETag && uploadedPart.ETag !== part.ETag) {
            throw new UploadFailedException(
              fileId,
              `Part ${part.PartNumber} ETag mismatch - expected ${part.ETag}, got ${uploadedPart.ETag}`,
            );
          }
        }
      } else {
        // Fallback: validate file size matches expected size (requirement 2 fallback)
        await this.validateFileSize(file);
      }
    } catch (error) {
      // If parts validation fails, fall back to file size validation
      if (error instanceof UploadFailedException) {
        throw error; // Re-throw our own exceptions
      }

      this.logger.warn(
        `Parts validation failed for file ${fileId}, falling back to size validation: ${error}`,
      );
      await this.validateFileSize(file);
    }
  }

  /**
   * Validates that the physical file size matches the expected size
   * Used as fallback when parts validation is not available (requirement 2)
   */
  private async validateFileSize(file: File): Promise<void> {
    try {
      const metadata = await this.storageService.getObjectMetadata(
        file.bucket,
        file.objectKey.toString(),
      );

      const expectedSize = file.getSizeInBytes();
      const actualSize = metadata.size;

      if (actualSize !== expectedSize) {
        throw new UploadFailedException(
          file.id,
          `File size mismatch - expected ${expectedSize} bytes, got ${actualSize} bytes`,
        );
      }
    } catch (error) {
      if (error instanceof UploadFailedException) {
        throw error;
      }

      throw new UploadFailedException(
        file.id,
        `Failed to validate file size: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
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
    expired?: boolean;
  } | null> {
    const file = await this.fileRepository.findById(fileId);
    if (!file) return null;

    const isExpired = this.isUploadExpired(file);

    return {
      fileId: file.id,
      status: file.status.getValue(),
      uploadId: file.getUploadIdString(),
      objectKey: file.objectKey.toString(),
      size: file.getSizeInBytes(),
      uploadedAt: file.status.isUploaded() ? file.updatedAt : undefined,
      expired: isExpired,
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

    // Check if upload is expired before allowing heartbeat
    if (this.isUploadExpired(file)) {
      throw new UploadExpiredException(fileId, 15);
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

        // Delete expired file record to avoid objectKey conflicts
        this.logger.log(`Deleting expired file record ${file.id}`);
        await this.fileRepository.delete(file.id);

        if (file.userId) {
          const staleCleanupResults = await Promise.allSettled([
            this.concurrencyService.releaseSlot(file.userId),
            this.fileQuotaService.releaseReservedQuota(file.userId, file.getSizeInBytes()),
          ]);

          // Log stale cleanup results
          staleCleanupResults.forEach((result, index) => {
            if (result.status === 'rejected') {
              const operation =
                index === 0 ? 'release concurrency slot' : 'release quota reservation';
              this.logger.debug(
                `Failed to ${operation} during stale upload cleanup for file ${file.id.toString()}: ${result.reason}`,
              );
            } else if (index === 1) {
              const quotaResult = result.value;
              if (
                typeof quotaResult === 'object' &&
                quotaResult &&
                'success' in quotaResult &&
                !quotaResult.success
              ) {
                this.logger.debug(
                  `Quota release was unsuccessful during stale upload cleanup for file ${file.id.toString()}`,
                );
              }
            }
          });
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

  /**
   * Validates app-specific file size requirements
   */
  private async validateAppSpecificRequirements(
    targetApps: string[],
    filename: string,
    size: number,
    userId: string,
  ): Promise<void> {
    // Get user's tier configuration
    const userConfig = await this.userStorageConfigRepository.findByUserIdWithTier(
      UserId.create(userId),
    );
    if (!userConfig) {
      throw new Error('User storage configuration not found');
    }

    // Extract file extension
    const fileExtension = this.extractFileExtension(filename);
    if (!fileExtension) {
      throw new Error('File must have an extension for app-specific validation');
    }

    // Get allowed file config from user's tier
    const allowedFileConfig = userConfig.allowedFileConfig;

    // Parse the JSON if it's a string, otherwise use as object
    let fileConfig: IAllowedFileConfig;
    if (typeof allowedFileConfig === 'string') {
      try {
        fileConfig = JSON.parse(allowedFileConfig) as IAllowedFileConfig;
      } catch (_error) {
        throw new Error('Invalid allowed file configuration format');
      }
    } else {
      fileConfig = allowedFileConfig;
    }

    const extensionConfig = fileConfig[fileExtension];
    if (!extensionConfig) {
      throw new Error(`File extension '${fileExtension}' is not allowed`);
    }

    // Check app-specific size limits
    for (const targetApp of targetApps) {
      if (targetApp === (TargetAppsEnum.NONE as string)) {
        continue;
      }
      const result = isValidFileSizeForStorageApp(
        targetApp as TargetAppsEnum,
        size,
        fileConfig,
        fileExtension,
      );
      if (!result.valid) {
        throw new AppFileSizeLimitExceededException(
          result.appName,
          size,
          extensionConfig.whatsAppMaxBytes,
          fileExtension,
        );
      }
    }
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
