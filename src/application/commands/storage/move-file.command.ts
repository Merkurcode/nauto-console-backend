import { ICommand, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { FileOperationsService } from '@core/services/file-operations.service';
import { FileResponseDto } from '@application/dtos/_responses/storage/storage.swagger.dto';
import { FileMapper } from '@application/mappers/file.mapper';

export class MoveFileCommand implements ICommand {
  constructor(
    public readonly fileId: string,
    public readonly newPath: string,
    public readonly userId?: string,
  ) {}
}

@Injectable()
@CommandHandler(MoveFileCommand)
export class MoveFileHandler implements ICommandHandler<MoveFileCommand, FileResponseDto> {
  constructor(private readonly fileOperationsService: FileOperationsService) {}

  async execute(command: MoveFileCommand): Promise<FileResponseDto> {
    const { fileId, newPath, userId } = command;

    const file = await this.fileOperationsService.moveFile({
      fileId,
      newPath,
      userId,
    });

    return FileMapper.toResponse(file);
  }
}
