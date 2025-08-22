import { ICommand, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { FileOperationsService } from '@core/services/file-operations.service';

export class DeleteFileCommand implements ICommand {
  constructor(
    public readonly fileId: string,
    public readonly userId?: string,
    public readonly hard?: string,
  ) {}
}

@Injectable()
@CommandHandler(DeleteFileCommand)
export class DeleteFileHandler implements ICommandHandler<DeleteFileCommand, void> {
  constructor(private readonly fileOperationsService: FileOperationsService) {}

  async execute(command: DeleteFileCommand): Promise<void> {
    const { fileId, userId, hard } = command;
    const hardDelete = hard === 'true';

    await this.fileOperationsService.deleteFile({
      fileId,
      userId,
      hardDelete,
    });
  }
}
