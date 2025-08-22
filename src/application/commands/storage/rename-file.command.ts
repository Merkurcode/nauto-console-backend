import { ICommand, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { FileOperationsService } from '@core/services/file-operations.service';
import { FileResponseDto } from '@application/dtos/_responses/storage/storage.swagger.dto';
import { FileMapper } from '@application/mappers/file.mapper';

export class RenameFileCommand implements ICommand {
  constructor(
    public readonly fileId: string,
    public readonly newFilename: string,
    public readonly userId?: string,
  ) {}
}

@Injectable()
@CommandHandler(RenameFileCommand)
export class RenameFileHandler implements ICommandHandler<RenameFileCommand, FileResponseDto> {
  constructor(private readonly fileOperationsService: FileOperationsService) {}

  async execute(command: RenameFileCommand): Promise<FileResponseDto> {
    const { fileId, newFilename, userId } = command;

    const file = await this.fileOperationsService.renameFile({
      fileId,
      newFilename,
      userId,
    });

    return FileMapper.toResponse(file);
  }
}
