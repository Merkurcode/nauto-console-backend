import { File } from '@core/entities/file.entity';
import { FileResponseDto } from '@application/dtos/_responses/storage/storage.swagger.dto';

export class FileMapper {
  static toResponse(file: File): FileResponseDto {
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
      targetApps: file.targetApps,
      storageDriver: file.storageDriver,
      createdAt: file.createdAt,
      updatedAt: file.updatedAt,
    };
  }

  static toResponseArray(files: File[]): FileResponseDto[] {
    return files.map(file => this.toResponse(file));
  }
}
