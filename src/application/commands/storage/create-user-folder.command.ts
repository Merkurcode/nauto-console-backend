import { ICommand, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { FileOperationsService } from '@core/services/file-operations.service';
import { StoragePaths } from '@core/utils/storage-paths';
import { ICreateFolderResponse } from '@application/dtos/_responses/storage/storage.response.interface';

export class CreateUserFolderCommand implements ICommand {
  constructor(
    public readonly path: string,
    public readonly userId: string,
    public readonly companyId: string,
  ) {}
}

@Injectable()
@CommandHandler(CreateUserFolderCommand)
export class CreateUserFolderHandler
  implements ICommandHandler<CreateUserFolderCommand, ICreateFolderResponse>
{
  constructor(private readonly fileOperationsService: FileOperationsService) {}

  async execute(command: CreateUserFolderCommand): Promise<ICreateFolderResponse> {
    const { path, userId, companyId } = command;

    // Build storage path: company-uuid/users/user-uuid/{path}
    const storagePath = StoragePaths.forUser(companyId, userId, path);

    const result = await this.fileOperationsService.createFolder({
      storagePath,
      userId,
      companyId,
    });

    return result;
  }
}
