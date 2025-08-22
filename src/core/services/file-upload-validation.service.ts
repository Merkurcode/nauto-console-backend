import { Injectable, Inject } from '@nestjs/common';
import { IUserStorageConfigRepository } from '@core/repositories/user-storage-config.repository.interface';
import { IFileRepository } from '@core/repositories/file.repository.interface';
import { UserId } from '@core/value-objects/user-id.vo';
import { UserStorageConfig } from '@core/entities/user-storage-config.entity';
import {
  UserStorageConfigNotFoundException,
  FileTypeNotAllowedException,
  StorageQuotaExceededException,
  ConcurrencyLimitExceededException,
} from '@core/exceptions/storage-domain.exceptions';
import { USER_STORAGE_CONFIG_REPOSITORY, FILE_REPOSITORY } from '@shared/constants/tokens';
import { FileQuotaService } from './file-quota.service';

export interface IFileUploadValidationParams {
  userId: string;
  filename: string;
  mimeType: string;
  size: number;
}

export interface IFileUploadValidationResult {
  isValid: boolean;
  userConfig: UserStorageConfig;
  availableStorage: number;
  currentConcurrentUploads: number;
  maxConcurrentUploads: number;
  errors: string[];
}

/**
 * File Upload Validation Service
 * - Valida políticas de tier (MIME/ext)
 * - Hace preflight de espacio usando FileQuotaService (incluye reservas)
 * - Provee mensajes ricos para UI
 *
 * NO realiza reservas; eso lo hace FileQuotaService en el endpoint de "init upload".
 */
@Injectable()
export class FileUploadValidationService {
  private readonly SIZES = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  constructor(
    @Inject(USER_STORAGE_CONFIG_REPOSITORY)
    private readonly userStorageConfigRepository: IUserStorageConfigRepository,

    @Inject(FILE_REPOSITORY)
    private readonly fileRepository: IFileRepository,

    // Delegamos chequeos de espacio/uso (con reservas) a este servicio
    private readonly fileQuotaService: FileQuotaService,
  ) {}

  /**
   * Preflight por archivo: valida MIME y si cabe en la cuota disponible (considerando reservas).
   */
  async validateFileUpload(
    params: IFileUploadValidationParams,
  ): Promise<IFileUploadValidationResult> {
    const { userId, filename, mimeType, size } = params;
    const errors: string[] = [];

    // 1) Config de usuario + tier
    const userConfig = await this.userStorageConfigRepository.findByUserIdWithTier(
      UserId.create(userId),
    );
    if (!userConfig) {
      throw new UserStorageConfigNotFoundException(userId);
    }

    // 2) MIME/ext contra tier
    const fileExtension = this.extractFileExtension(filename);
    if (!userConfig.isMimeTypeAllowed(mimeType, fileExtension)) {
      errors.push(
        `File type '${mimeType}' (${fileExtension}) not allowed for your tier. ` +
          `Allowed types: ${userConfig.getAllowedMimeTypes().join(', ')}`,
      );
    }

    // 3) Espacio disponible (incluye reservas actuales)
    const quota = await this.fileQuotaService.getQuotaUsage(userId);
    const availableStorage = quota.availableSpace;

    if (size > availableStorage) {
      errors.push(
        `File size ${this.formatBytes(size)} exceeds available storage ` +
          `${this.formatBytes(availableStorage)}. Used: ${this.formatBytes(quota.currentUsage)}/${this.formatBytes(quota.maxQuota)}`,
      );
    }

    // 4) Concurrencia según dominio (BD). Mantener alineado con FileQuotaService.
    const currentConcurrentUploads = await this.fileRepository.getUserActiveUploadsCount(userId);
    const maxConcurrentUploads = userConfig.maxSimultaneousFiles;

    if (currentConcurrentUploads >= maxConcurrentUploads) {
      errors.push(
        `Maximum concurrent uploads reached: ${currentConcurrentUploads}/${maxConcurrentUploads}. ` +
          `Please wait for current uploads to complete.`,
      );
    }

    return {
      isValid: errors.length === 0,
      userConfig,
      availableStorage,
      currentConcurrentUploads,
      maxConcurrentUploads,
      errors,
    };
  }

  /**
   * Igual que validateFileUpload pero lanza excepciones específicas para el dominio.
   * Útil si quieres “short-circuit” en controladores.
   */
  async validateFileUploadOrThrow(params: IFileUploadValidationParams): Promise<void> {
    const validation = await this.validateFileUpload(params);

    if (!validation.isValid) {
      for (const error of validation.errors) {
        if (error.includes('not allowed for your tier')) {
          const fileExtension = this.extractFileExtension(params.filename);
          throw new FileTypeNotAllowedException(
            fileExtension,
            params.mimeType,
            validation.userConfig.getAllowedMimeTypes(),
          );
        }
        if (error.includes('exceeds available storage')) {
          // Relee números frescos para el detalle exacto
          const quota = await this.fileQuotaService.getQuotaUsage(params.userId);
          throw new StorageQuotaExceededException(
            params.userId,
            quota.currentUsage,
            params.size,
            quota.maxQuota,
          );
        }
        if (error.includes('Maximum concurrent uploads')) {
          throw new ConcurrencyLimitExceededException(
            params.userId,
            validation.maxConcurrentUploads,
          );
        }
      }

      throw new Error(`File upload validation failed: ${validation.errors.join(', ')}`);
    }
  }

  /**
   * Estado resumido para UI/Dashboard (storage + concurrencia).
   */
  async getUserUploadStatus(userId: string): Promise<{
    storageUsed: number;
    storageLimit: number;
    storageAvailable: number;
    storageUsedPercentage: number;
    concurrentUploads: number;
    maxConcurrentUploads: number;
    tierName: string;
    allowedMimeTypes: string[];
    maxFileSize: number;
  }> {
    const userConfig = await this.userStorageConfigRepository.findByUserIdWithTier(
      UserId.create(userId),
    );
    if (!userConfig) {
      throw new UserStorageConfigNotFoundException(userId);
    }

    // Uso + disponible (incluye reservas)
    const quota = await this.fileQuotaService.getQuotaUsage(userId);
    const storageUsed = quota.currentUsage;
    const storageLimit = quota.maxQuota;
    const storageAvailable = quota.availableSpace;
    const storageUsedPercentage =
      storageLimit > 0 ? Math.round((storageUsed / storageLimit) * 100) : 0;

    // Concurrencia desde BD
    const concurrentUploads = await this.fileRepository.getUserActiveUploadsCount(userId);

    return {
      storageUsed,
      storageLimit,
      storageAvailable,
      storageUsedPercentage,
      concurrentUploads,
      maxConcurrentUploads: userConfig.maxSimultaneousFiles,
      tierName: userConfig.storageTier?.name || 'unknown',
      allowedMimeTypes: userConfig.getAllowedMimeTypes(),
      maxFileSize: storageLimit, // si no tienes límite por archivo, refleja el total
    };
  }

  /**
   * Preflight por lote: verifica espacio total disponible y MIME de cada archivo.
   * (No reserva; la reserva debe hacerse en el init del upload con FileQuotaService.batchQuotaCheck)
   */
  async validateBatchUpload(
    userId: string,
    files: Array<{ filename: string; mimeType: string; size: number }>,
  ): Promise<{
    isValid: boolean;
    validFiles: string[];
    invalidFiles: Array<{ filename: string; reason: string }>;
    totalSize: number;
    availableStorage: number;
  }> {
    const userConfig = await this.userStorageConfigRepository.findByUserIdWithTier(
      UserId.create(userId),
    );
    if (!userConfig) {
      throw new UserStorageConfigNotFoundException(userId);
    }

    const quota = await this.fileQuotaService.getQuotaUsage(userId);
    const availableStorage = quota.availableSpace;

    const totalSize = (files ?? []).reduce((sum, f) => sum + (f?.size ?? 0), 0);
    if (totalSize > availableStorage) {
      return {
        isValid: false,
        validFiles: [],
        invalidFiles: files.map(f => ({
          filename: f.filename,
          reason: `Total batch size ${this.formatBytes(totalSize)} exceeds available storage ${this.formatBytes(availableStorage)}`,
        })),
        totalSize,
        availableStorage,
      };
    }

    const validFiles: string[] = [];
    const invalidFiles: Array<{ filename: string; reason: string }> = [];

    // Valida MIME/extension por archivo (política de tier)
    for (const f of files) {
      const ext = this.extractFileExtension(f.filename);
      if (!userConfig.isMimeTypeAllowed(f.mimeType, ext)) {
        invalidFiles.push({
          filename: f.filename,
          reason: `File type '${f.mimeType}' (${ext}) not allowed for your tier`,
        });
      } else {
        validFiles.push(f.filename);
      }
    }

    return {
      isValid: invalidFiles.length === 0,
      validFiles,
      invalidFiles,
      totalSize,
      availableStorage,
    };
  }

  // ---------- helpers ----------
  private extractFileExtension(filename: string): string {
    const parts = (filename ?? '').split('.');

    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
  }

  private formatBytes(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 Bytes';
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${i >= this.SIZES.length ? '?' : this.SIZES[i]}`;
  }
}
