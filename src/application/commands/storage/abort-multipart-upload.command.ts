import { ICommand, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { MultipartUploadService } from '@core/services/multipart-upload.service';

export class AbortMultipartUploadCommand implements ICommand {
  constructor(
    public readonly userId: string,
    public readonly fileId: string,
    public readonly reason?: string,
  ) {}
}

@Injectable()
@CommandHandler(AbortMultipartUploadCommand)
export class AbortMultipartUploadHandler
  implements ICommandHandler<AbortMultipartUploadCommand, void>
{
  constructor(private readonly multipartUploadService: MultipartUploadService) {}

  async execute(command: AbortMultipartUploadCommand): Promise<void> {
    const { userId, fileId, reason } = command;

    await this.multipartUploadService.abortUpload(userId, fileId, true, reason);
  }
}
