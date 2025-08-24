import { ICommand, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MultipartUploadService } from '@core/services/multipart-upload.service';
import { StoragePaths } from '@core/utils/storage-paths';
import { IInitiateMultipartUploadResponse } from '@application/dtos/_responses/storage/storage.response.interface';

export class InitiateUserUploadCommand implements ICommand {
  constructor(
    public readonly userId: string,
    public readonly companyId: string,
    public readonly path: string,
    public readonly filename: string,
    public readonly originalName: string,
    public readonly mimeType: string,
    public readonly size: number,
    public readonly upsert: boolean = false,
    public readonly autoRename: boolean = false,
  ) {}
}

@Injectable()
@CommandHandler(InitiateUserUploadCommand)
export class InitiateUserUploadHandler
  implements ICommandHandler<InitiateUserUploadCommand, IInitiateMultipartUploadResponse>
{
  constructor(
    private readonly multipartUploadService: MultipartUploadService,
    private readonly configService: ConfigService,
  ) {}

  async execute(command: InitiateUserUploadCommand): Promise<IInitiateMultipartUploadResponse> {
    const { userId, companyId, path, filename, originalName, mimeType, size, upsert, autoRename } =
      command;

    // Simple path validation
    StoragePaths.validateUserPath(path);

    // FACT: Always user space
    const storagePath = StoragePaths.forUser(companyId, userId, path);

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
