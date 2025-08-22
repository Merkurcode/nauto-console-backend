import { ICommand, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable, Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import { FileOperationsService } from '@core/services/file-operations.service';
import { FileAccessControlService } from '@core/services/file-access-control.service';
import { FileResponseDto } from '@application/dtos/_responses/storage/storage.swagger.dto';
import { FileMapper } from '@application/mappers/file.mapper';
import { IFileRepository } from '@core/repositories/file.repository.interface';
import { FILE_REPOSITORY } from '@shared/constants/tokens';

export class SetFileVisibilityCommand implements ICommand {
  constructor(
    public readonly fileId: string,
    public readonly isPublic: boolean,
    public readonly userId?: string,
  ) {}
}

@Injectable()
@CommandHandler(SetFileVisibilityCommand)
export class SetFileVisibilityHandler
  implements ICommandHandler<SetFileVisibilityCommand, FileResponseDto>
{
  constructor(
    private readonly fileOperationsService: FileOperationsService,
    private readonly fileAccessControlService: FileAccessControlService,
    @Inject(FILE_REPOSITORY) private readonly fileRepository: IFileRepository,
  ) {}

  async execute(command: SetFileVisibilityCommand): Promise<FileResponseDto> {
    const { fileId, isPublic, userId } = command;

    // Get the file first
    const file = await this.fileRepository.findById(fileId);
    if (!file) {
      throw new NotFoundException(`File with ID ${fileId} not found`);
    }

    // Check if user has permission to change visibility
    const user = userId
      ? {
          sub: userId,
          roles: [],
          companyId: '',
          email: '',
          isBanned: false,
          bannedUntil: null,
          banReason: null,
          isActive: true,
        }
      : null;
    if (!user) {
      throw new ForbiddenException('Authentication required to change file visibility');
    }

    const accessRules = this.fileAccessControlService.canChangeVisibility(file, user);
    if (!accessRules.canWrite) {
      throw new ForbiddenException(`Access denied: ${accessRules.reason}`);
    }

    // Update file visibility
    const updatedFile = await this.fileOperationsService.setFileVisibility({
      fileId,
      isPublic,
      userId,
    });

    return FileMapper.toResponse(updatedFile);
  }
}
