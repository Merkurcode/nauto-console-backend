import { ICommand, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { FileOperationsService } from '@core/services/file-operations.service';
import { FileResponseDto } from '@application/dtos/_responses/storage/storage.swagger.dto';
import { FileMapper } from '@application/mappers/file.mapper';
import { StoragePaths } from '@core/utils/storage-paths';
import { InvalidParameterException } from '@core/exceptions/domain-exceptions';

export class MoveFileCommand implements ICommand {
  constructor(
    public readonly fileId: string,
    public readonly newPath: string,
    public readonly userId: string,
    public readonly companyId: string,
  ) {}
}

@Injectable()
@CommandHandler(MoveFileCommand)
export class MoveFileHandler implements ICommandHandler<MoveFileCommand, FileResponseDto> {
  constructor(private readonly fileOperationsService: FileOperationsService) {}

  async execute(command: MoveFileCommand): Promise<FileResponseDto> {
    const { fileId, newPath, userId, companyId } = command;

    // Validate user ID
    if (!userId) {
      throw new InvalidParameterException('userId', userId, 'User ID is required');
    }

    // Build full storage path constrained to user space
    // This ensures the file can only be moved within the user's personal storage area
    const fullStoragePath = StoragePaths.forUser(companyId, userId, newPath);

    const file = await this.fileOperationsService.moveFile({
      fileId,
      newStoragePath: fullStoragePath,
      userId,
    });

    return FileMapper.toResponse(file);
  }
}
