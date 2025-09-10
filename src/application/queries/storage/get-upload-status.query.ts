import { Injectable, Inject } from '@nestjs/common';
import { IQuery, IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { IFileRepository } from '@core/repositories/file.repository.interface';
import { IStorageService, IUploadStatusResult } from '@core/repositories/storage.service.interface';
import { FILE_REPOSITORY, STORAGE_SERVICE } from '@shared/constants/tokens';
import { FileAccessDeniedException } from '@core/exceptions/storage-domain.exceptions';
import { FileAccessControlService } from '@core/services/file-access-control.service';

export class GetUploadStatusQuery implements IQuery {
  constructor(
    public readonly fileId: string,
    public readonly userId: string,
    public readonly companyId: string,
    public readonly isCommon: boolean,
  ) {}
}

export interface IGetUploadStatusResponse {
  message: string | null;
  fileId: string;
  status: string;
  uploadId: string | null;
  progress: number;
  completedPartsCount: number; // con ETag presente
  totalPartsCount: number; // detectadas en ListParts
  uploadedBytes: number;
  nextPartNumber: number; // sugerencia (primer hueco o último+1)
  maxBytes: number;
  remainingBytes: number;
  canComplete: boolean; // total <= maxBytes (si maxBytes está definido)
  parts: Array<{ partNumber: number; size: number; etag: string }>;
}

@Injectable()
@QueryHandler(GetUploadStatusQuery)
export class GetUploadStatusHandler
  implements IQueryHandler<GetUploadStatusQuery, IGetUploadStatusResponse | null>
{
  constructor(
    @Inject(FILE_REPOSITORY)
    private readonly fileRepository: IFileRepository,
    @Inject(STORAGE_SERVICE)
    private readonly storageService: IStorageService,
    private readonly fileAccessControlService: FileAccessControlService,
  ) {}

  async execute(query: GetUploadStatusQuery): Promise<IGetUploadStatusResponse | null> {
    const { fileId, userId, companyId, isCommon } = query;

    const file = await this.fileRepository.findById(fileId);
    if (!file) {
      return null;
    }

    if (isCommon) {
      // Access control - only owner or if file is public
      if (!file.isPublic && file.userId !== userId) {
        throw new FileAccessDeniedException(fileId, userId);
      }
    } else {
      // Validate access to the file (this will throw if access denied)
      const userPayload = { sub: userId, companyId };
      this.fileAccessControlService.validateFileAccess(file, userPayload, 'read');
    }

    // Get part tracking information for multipart uploads
    let completedParts = 0;
    let totalParts: number | null = null;
    let progress = 0;
    let status: IUploadStatusResult | null = null;

    if (file.status.isUploading() && file.getUploadIdString()) {
      try {
        status = await this.storageService.getUploadStatus(
          file.bucket,
          file.objectKey.toString(),
          file.getUploadIdString()!,
          file.size.getBytes(),
        );

        completedParts = status.completedPartsCount;
        totalParts = status.totalPartsCount;

        progress = Math.round((status.uploadedBytes / status.maxBytes) * 100);
      } catch (_error) {
        // If we can't get part info, use fallback values
        completedParts = 0;
        totalParts = null;
        progress = 0; // Default progress for active uploads
      }
    } else if (file.status.isUploaded()) {
      progress = 100;
    }

    return {
      message: file.status.isUploaded()
        ? 'Upload completed'
        : file.status.isUploading()
          ? `Upload in progress (${completedParts}${totalParts ? `/${totalParts}` : ''} parts completed)`
          : file.status.isCopying()
            ? 'File copying in progress'
            : file.status.isErasing()
              ? 'File scheduled for deletion'
              : 'Upload pending',
      fileId: file.id,
      status: file.status.getValue(),
      uploadId: file.getUploadIdString(),
      progress,
      completedPartsCount: completedParts,
      totalPartsCount: totalParts,
      uploadedBytes: status?.uploadedBytes ?? null,
      nextPartNumber: status?.nextPartNumber ?? null,
      maxBytes: status?.maxBytes ?? null,
      remainingBytes: status?.remainingBytes ?? null,
      canComplete: status?.canComplete ?? null,
      parts: status?.parts ?? [],
    };
  }
}
