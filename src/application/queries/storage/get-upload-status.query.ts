import { Injectable, Inject } from '@nestjs/common';
import { IQuery, IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { IFileRepository } from '@core/repositories/file.repository.interface';
import { IStorageService } from '@core/repositories/storage.service.interface';
import { FILE_REPOSITORY, STORAGE_SERVICE } from '@shared/constants/tokens';
import { FileAccessDeniedException } from '@core/exceptions/storage-domain.exceptions';

export class GetUploadStatusQuery implements IQuery {
  constructor(
    public readonly fileId: string,
    public readonly userId: string,
  ) {}
}

export interface IGetUploadStatusResponse {
  fileId: string;
  status: string;
  progress: number;
  completedParts: number;
  totalParts: number | null;
  uploadId: string | null;
  message: string | null;
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
  ) {}

  async execute(query: GetUploadStatusQuery): Promise<IGetUploadStatusResponse | null> {
    const { fileId, userId } = query;

    const file = await this.fileRepository.findById(fileId);
    if (!file) {
      return null;
    }

    // Access control - only owner or if file is public
    if (!file.isPublic && file.userId !== userId) {
      throw new FileAccessDeniedException(fileId, userId);
    }

    // Get part tracking information for multipart uploads
    let completedParts = 0;
    let totalParts: number | null = null;
    let progress = 0;

    if (file.status.isUploading() && file.getUploadIdString()) {
      try {
        const partsInfo = await this.storageService.listUploadParts(
          file.bucket,
          file.objectKey.toString(),
          file.getUploadIdString()!,
        );

        completedParts = partsInfo.completedPartsCount;
        totalParts = partsInfo.totalPartsCount;

        // Calculate progress based on completed parts
        if (totalParts > 0) {
          progress = Math.round((completedParts / totalParts) * 100);
        } else {
          progress = completedParts > 0 ? 50 : 0; // Fallback progress calculation
        }
      } catch (_error) {
        // If we can't get part info, use fallback values
        completedParts = 0;
        totalParts = null;
        progress = 25; // Default progress for active uploads
      }
    } else if (file.status.isUploaded()) {
      progress = 100;
    } else if (file.status.isFailed()) {
      progress = 0;
    }

    return {
      fileId: file.id,
      status: file.status.getValue(),
      progress,
      completedParts,
      totalParts,
      uploadId: file.getUploadIdString(),
      message: file.status.isUploaded()
        ? 'Upload completed'
        : file.status.isFailed()
          ? 'Upload failed'
          : file.status.isUploading()
            ? `Upload in progress (${completedParts}${totalParts ? `/${totalParts}` : ''} parts completed)`
            : 'Upload pending',
    };
  }
}
