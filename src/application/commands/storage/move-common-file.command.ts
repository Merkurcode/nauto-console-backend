import { ICommand, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { FileOperationsService } from '@core/services/file-operations.service';
import { StorageAreaType } from '@shared/types/storage-areas.types';
import { StorageAreaUtils } from '@shared/utils/storage-area.utils';
import { FileResponseDto } from '@application/dtos/_responses/storage/storage.swagger.dto';
import { FileMapper } from '@application/mappers/file.mapper';

export class MoveCommonFileCommand implements ICommand {
  constructor(
    public readonly fileId: string,
    public readonly area: StorageAreaType,
    public readonly newPath: string,
    public readonly userId: string,
    public readonly companyId: string,
  ) {}
}

@Injectable()
@CommandHandler(MoveCommonFileCommand)
export class MoveCommonFileHandler
  implements ICommandHandler<MoveCommonFileCommand, FileResponseDto>
{
  constructor(private readonly fileOperationsService: FileOperationsService) {}

  async execute(command: MoveCommonFileCommand): Promise<FileResponseDto> {
    const { fileId, area, newPath, userId, companyId } = command;

    // Build full storage path for common area
    const commonFolder = StorageAreaUtils.areaToCommonFolder(area);
    const fullStoragePath = StorageAreaUtils.getStoragePathForCommonFolder(
      commonFolder,
      companyId,
      newPath,
    );

    const file = await this.fileOperationsService.moveFile({
      fileId,
      newStoragePath: fullStoragePath,
      userId,
    });

    return FileMapper.toResponse(file);
  }
}
