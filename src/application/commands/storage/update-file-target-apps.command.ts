import { ICommand, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { FileOperationsService } from '@core/services/file-operations.service';
import { IFileResponse } from '@application/dtos/_responses/storage/storage.response.interface';
import { FileMapper } from '@application/mappers/file.mapper';
import { TargetAppsEnum } from '@shared/constants/target-apps.enum';

export class UpdateFileTargetAppsCommand implements ICommand {
  constructor(
    public readonly fileId: string,
    public readonly targetApps: TargetAppsEnum[],
    public readonly userId: string,
    public readonly companyId: string,
  ) {}
}

@Injectable()
@CommandHandler(UpdateFileTargetAppsCommand)
export class UpdateFileTargetAppsHandler
  implements ICommandHandler<UpdateFileTargetAppsCommand, IFileResponse>
{
  constructor(private readonly fileOperationsService: FileOperationsService) {}

  async execute(command: UpdateFileTargetAppsCommand): Promise<IFileResponse> {
    const { fileId, targetApps, userId, companyId } = command;

    // Convert enum array to string array
    const targetAppsStrings = targetApps.map(app => app.toString());

    // Use domain service to update target apps
    const updatedFile = await this.fileOperationsService.updateFileTargetApps(
      fileId,
      targetAppsStrings,
      userId,
      companyId,
    );

    // Map domain entity to response DTO
    return FileMapper.toResponse(updatedFile);
  }
}
