import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { File } from '@core/entities/file.entity';
import { FileResponseDto } from '@application/dtos/_responses/storage/storage.swagger.dto';
import { IStorageService } from '@core/repositories/storage.service.interface';
import { ILogger } from '@core/interfaces/logger.interface';
import { STORAGE_SERVICE, LOGGER_SERVICE } from '@shared/constants/tokens';

@Injectable()
export class EnhancedFileMapper {
  constructor(
    @Inject(STORAGE_SERVICE)
    private readonly storageService: IStorageService,
    private readonly configService: ConfigService,
    @Inject(LOGGER_SERVICE)
    private readonly logger: ILogger,
  ) {
    this.logger.setContext(EnhancedFileMapper.name);
  }

  async toResponseWithSignedUrl(
    file: File,
  ): Promise<FileResponseDto & { signedUrl?: string; signedUrlExpiresAt?: Date }> {
    const baseResponse = this.toResponse(file);

    // Only generate signed URLs for uploaded files
    if (file.status.isUploaded() /*&& !file.isPublic*/) {
      try {
        const maxExpiryHours = this.configService.get<number>('storage.presign.maxExpiryHours', 24);
        const expirationSeconds = maxExpiryHours * 3600;

        const { url } = await this.storageService.generatePresignedGetUrl(
          file.bucket,
          file.objectKey.toString(),
          expirationSeconds,
        );

        const expiresAt = new Date(Date.now() + expirationSeconds * 1000);

        return {
          ...baseResponse,
          signedUrl: url,
          signedUrlExpiresAt: expiresAt,
        };
      } catch (error) {
        // If signed URL generation fails, return without signed URL
        this.logger.warn(
          `Failed to generate signed URL for file ${file.id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
      }
    }

    return baseResponse;
  }

  async toResponseArrayWithSignedUrls(
    files: File[],
  ): Promise<Array<FileResponseDto & { signedUrl?: string; signedUrlExpiresAt?: Date }>> {
    const promises = files.map(file => this.toResponseWithSignedUrl(file));

    return Promise.all(promises);
  }

  private toResponse(file: File): FileResponseDto {
    return {
      id: file.id,
      filename: file.filename,
      originalName: file.originalName,
      path: file.path,
      objectKey: file.objectKey.toString(),
      mimeType: file.mimeType,
      size: file.getSizeInBytes(),
      bucket: file.bucket,
      userId: file.userId,
      isPublic: file.isPublic,
      status: file.status.getValue(),
      uploadId: file.getUploadIdString(),
      etag: file.getETagString(),
      createdAt: file.createdAt,
      updatedAt: file.updatedAt,
    };
  }
}
