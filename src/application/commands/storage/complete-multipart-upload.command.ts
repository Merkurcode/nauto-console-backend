import { ICommand, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { MultipartUploadService } from '@core/services/multipart-upload.service';

export interface ICompletedPartDto {
  ETag: string;
  PartNumber: number;
}

export class CompleteMultipartUploadCommand implements ICommand {
  constructor(
    public readonly userId: string,
    public readonly fileId: string,
    public readonly parts: ICompletedPartDto[],
  ) {}
}

@Injectable()
@CommandHandler(CompleteMultipartUploadCommand)
export class CompleteMultipartUploadHandler
  implements ICommandHandler<CompleteMultipartUploadCommand, void>
{
  constructor(private readonly multipartUploadService: MultipartUploadService) {}

  async execute(command: CompleteMultipartUploadCommand): Promise<void> {
    const { userId, fileId, parts } = command;

    await this.multipartUploadService.completeUpload(userId, fileId, parts, true);
  }
}
