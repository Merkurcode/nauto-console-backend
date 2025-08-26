import { ICommand, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { MultipartUploadService } from '@core/services/multipart-upload.service';

export class HeartbeatUploadCommand implements ICommand {
  constructor(
    public readonly userId: string,
    public readonly fileId: string,
  ) {}
}

@Injectable()
@CommandHandler(HeartbeatUploadCommand)
export class HeartbeatUploadHandler implements ICommandHandler<HeartbeatUploadCommand, void> {
  constructor(private readonly multipartUploadService: MultipartUploadService) {}

  async execute(command: HeartbeatUploadCommand): Promise<void> {
    const { userId, fileId } = command;

    await this.multipartUploadService.heartbeat(fileId, userId);
  }
}
