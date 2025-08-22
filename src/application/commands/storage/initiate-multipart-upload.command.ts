import { ICommand, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MultipartUploadService } from '@core/services/multipart-upload.service';

export interface IInitiateMultipartUploadResponse {
  fileId: string;
  uploadId: string;
  objectKey: string;
}

export class InitiateMultipartUploadCommand implements ICommand {
  constructor(
    public readonly userId: string,
    public readonly path: string,
    public readonly filename: string,
    public readonly originalName: string,
    public readonly mimeType: string,
    public readonly size: number,
    public readonly bucket?: string,
  ) {}
}

@Injectable()
@CommandHandler(InitiateMultipartUploadCommand)
export class InitiateMultipartUploadHandler
  implements ICommandHandler<InitiateMultipartUploadCommand, IInitiateMultipartUploadResponse>
{
  constructor(
    private readonly multipartUploadService: MultipartUploadService,
    private readonly configService: ConfigService,
  ) {}

  async execute(
    command: InitiateMultipartUploadCommand,
  ): Promise<IInitiateMultipartUploadResponse> {
    // Debug: Command handler execution (removed console.log)

    const { userId, path, filename, originalName, mimeType, size, bucket } = command;

    // Use configured default bucket if not provided
    const defaultBucket = this.configService.get<string>('storage.defaultBucket', 'files');
    const targetBucket = bucket || defaultBucket;

    const result = await this.multipartUploadService.initiateUpload({
      userId,
      path,
      filename,
      originalName,
      mimeType,
      size,
      bucket: targetBucket,
    });

    return result;
  }
}
