/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { Request } from 'express';
import { ConfigService } from '@nestjs/config';
import { StorageService } from '@core/services/storage.service';
import { UserStorageConfigService } from '@core/services/user-storage-config.service';
import { ILogger } from '@core/interfaces/logger.interface';
import { LOGGER_SERVICE } from '@shared/constants/tokens';

@Injectable()
export class FileUploadLimitGuard implements CanActivate {
  private readonly enableLogs: boolean;

  constructor(
    private readonly storageService: StorageService,
    private readonly userStorageConfigService: UserStorageConfigService,
    private readonly configService: ConfigService,
    @Inject(LOGGER_SERVICE) private readonly logger: ILogger,
  ) {
    this.enableLogs = this.configService.get<boolean>('security.signatureValidationLogs', false);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const user = (request as any).user;

    // Only apply to file uploads
    const contentType = request.headers['content-type'] || '';
    if (!contentType.includes('multipart/form-data')) {
      return true;
    }

    // Skip validation if no user (shouldn't happen with JwtAuthGuard)
    if (!user || !user.sub) {
      if (this.enableLogs) {
        this.logger.warn('FileUploadLimitGuard: No user found in request');
      }

      return false;
    }

    // Check user limits and current usage
    try {
      // Get user storage config (create default if doesn't exist)
      const userStorageConfig = await this.userStorageConfigService.getUserStorageConfigByUserId(
        user.sub,
      );
      if (!userStorageConfig) {
        // Create with default "basic" tier ID - this should be obtained from a service/repository
        // For now, we'll throw an error to indicate missing configuration
        throw new BadRequestException(
          'User storage configuration not found. Please contact administrator to set up your storage tier.',
        );
      }

      // Get active user files (optimized query)
      const activeFiles = await this.storageService.getActiveFilesByUserId(user.sub);
      const currentFileCount = activeFiles.length;

      // Calculate current storage usage
      const currentStorageUsed = activeFiles.reduce(
        (total, file) => total + BigInt(file.size),
        BigInt(0),
      );

      // Use tier-based limits if storage tier is loaded
      const maxFilesPerUser = userStorageConfig.storageTier
        ? userStorageConfig.storageTier.maxSimultaneousFiles.getValue()
        : 1; // fallback

      if (currentFileCount > maxFilesPerUser) {
        if (this.enableLogs) {
          this.logger.warn(
            `User ${user.sub} attempted upload but has ${currentFileCount}/${maxFilesPerUser} files`,
          );
        }

        throw new BadRequestException(
          `Maximum ${maxFilesPerUser} files allowed per user. You currently have ${currentFileCount} files. Please delete some files before uploading new ones.`,
        );
      }

      // Check storage space limit if tier is loaded
      if (userStorageConfig.storageTier) {
        if (currentStorageUsed >= userStorageConfig.getMaxStorageInBytes()) {
          const currentMB = Math.round(Number(currentStorageUsed) / (1024 * 1024));
          const maxMB = userStorageConfig.getMaxStorageInMB();

          if (this.enableLogs) {
            this.logger.warn(
              `User ${user.sub} attempted upload but storage full: ${currentMB}MB/${maxMB}MB`,
            );
          }

          throw new BadRequestException(
            `Storage quota exceeded. You are using ${currentMB}MB of your ${maxMB}MB limit. Please delete some files before uploading new ones.`,
          );
        }
      }

      // Get files being uploaded (assuming 1 since streaming is removed)
      const filesBeingUploaded = 1;

      // Check if file count would exceed limit
      if (currentFileCount + filesBeingUploaded > maxFilesPerUser) {
        const wouldExceedBy = currentFileCount + filesBeingUploaded - maxFilesPerUser;

        if (this.enableLogs) {
          this.logger.warn(
            `User ${user.sub} upload would exceed file limit: ${currentFileCount} + ${filesBeingUploaded} > ${maxFilesPerUser}`,
          );
        }

        throw new BadRequestException(
          `Upload denied. You have ${currentFileCount} files and are trying to upload ${filesBeingUploaded} more. ` +
            `This would exceed the limit of ${maxFilesPerUser} files per user by ${wouldExceedBy} file(s).`,
        );
      }

      // Since streaming is removed, we can't estimate upload size beforehand
      // Upload size validation will happen at the actual upload endpoint

      if (this.enableLogs) {
        const currentMB = Math.round(Number(currentStorageUsed) / (1024 * 1024));
        const maxMB = userStorageConfig.storageTier
          ? userStorageConfig.getMaxStorageInMB()
          : 'unknown';
        this.logger.log(
          `User ${user.sub} upload allowed: ${currentFileCount + filesBeingUploaded}/${maxFilesPerUser} files, ` +
            `${currentMB}MB/${maxMB}MB storage`,
        );
      }

      return true;
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }

      if (this.enableLogs) {
        this.logger.error({
          message: 'FileUploadLimitGuard error',
          error: error instanceof Error ? error.message : String(error),
        });
      }

      // If we can't check the limit, allow the upload (fail open for availability)
      // but log the issue for investigation
      this.logger.error({
        message: 'Failed to check user file limit, allowing upload',
        error: (error as Error).message,
      });

      return true;
    }
  }
}
