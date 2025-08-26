import { ICommand, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { FileOperationsService } from '@core/services/file-operations.service';
import { CommonFolder } from '@shared/types/storage-areas.types';
import { StorageAreaUtils } from '@shared/utils/storage-area.utils';
import { ICreateFolderResponse } from '@application/dtos/_responses/storage/storage.response.interface';

export class CreateCommonFolderCommand implements ICommand {
  constructor(
    public readonly area: CommonFolder,
    public readonly path: string,
    public readonly userId: string,
    public readonly companyId: string,
  ) {}
}

@Injectable()
@CommandHandler(CreateCommonFolderCommand)
export class CreateCommonFolderHandler
  implements ICommandHandler<CreateCommonFolderCommand, ICreateFolderResponse>
{
  constructor(private readonly fileOperationsService: FileOperationsService) {}

  async execute(command: CreateCommonFolderCommand): Promise<ICreateFolderResponse> {
    const { area, path, userId, companyId } = command;

    // Build storage path: company-uuid/common/{area}/{path}
    const storagePath = StorageAreaUtils.getStoragePathForCommonFolder(area, companyId, path);

    const result = await this.fileOperationsService.createFolder({
      storagePath,
      userId,
      companyId,
    });

    return result;
  }
}
