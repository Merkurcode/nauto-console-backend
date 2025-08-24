import { ICommand, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MultipartUploadService } from '@core/services/multipart-upload.service';
import { StoragePaths } from '@core/utils/storage-paths';
import { CommonFolder } from '@shared/types/storage-areas.types';
import { StorageAreaUtils } from '@shared/utils/storage-area.utils';
import { IInitiateMultipartUploadResponse } from '@application/dtos/_responses/storage/storage.response.interface';

export class InitiateCommonUploadCommand implements ICommand {
  constructor(
    public readonly area: CommonFolder,
    public readonly path: string,
    public readonly filename: string,
    public readonly originalName: string,
    public readonly mimeType: string,
    public readonly size: number,
    public readonly userId: string,
    public readonly companyId: string,
    public readonly upsert: boolean = false,
    public readonly autoRename: boolean = false,
  ) {}
}

@Injectable()
@CommandHandler(InitiateCommonUploadCommand)
export class InitiateCommonUploadHandler
  implements ICommandHandler<InitiateCommonUploadCommand, IInitiateMultipartUploadResponse>
{
  constructor(
    private readonly multipartUploadService: MultipartUploadService,
    private readonly configService: ConfigService,
  ) {}

  async execute(command: InitiateCommonUploadCommand): Promise<IInitiateMultipartUploadResponse> {
    const {
      area,
      path,
      filename,
      originalName,
      mimeType,
      size,
      userId,
      companyId,
      upsert,
      autoRename,
    } = command;

    // Simple path validation
    StoragePaths.validateUserPath(path);

    // FACT: Always common area (products or marketing)
    const storagePath = StorageAreaUtils.getStoragePathForCommonFolder(area, companyId, path);

    return this.multipartUploadService.initiateUpload(
      {
        bucket: this.configService.get<string>('storage.defaultBucket'),
        storagePath,
        filename,
        originalName,
        mimeType,
        size,
        userId,
        companyId,
        upsert,
        autoRename,
      },
      true,
    );
  }
}
