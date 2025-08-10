import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable, Inject } from '@nestjs/common';
import { StorageService, IStorageFile } from '@core/services/storage.service';
import { FileMapper } from '../../mappers/file.mapper';
import { IFileResponse } from '../../dtos/_responses/storage/file.response.interface';
import { AUDIT_LOG_SERVICE } from '@shared/constants/tokens';
import { AuditLogService } from '@core/services/audit-log.service';
import { UserId } from '@core/value-objects/user-id.vo';

export class UploadFileCommand {
  constructor(
    public readonly file: IStorageFile,
    public readonly userId?: string,
  ) {}
}

@Injectable()
@CommandHandler(UploadFileCommand)
export class UploadFileCommandHandler implements ICommandHandler<UploadFileCommand, IFileResponse> {
  constructor(
    private readonly storageService: StorageService,
    private readonly fileMapper: FileMapper,
    @Inject(AUDIT_LOG_SERVICE)
    private readonly auditLogService: AuditLogService,
  ) {}

  async execute(command: UploadFileCommand): Promise<IFileResponse> {
    const startTime = Date.now();
    const { file, userId } = command;

    try {
      const fileEntity = await this.storageService.uploadFile(file, userId);
      const duration = Date.now() - startTime;

      // Audit log for successful file upload
      this.auditLogService.logUserAction(
        'create',
        `File uploaded successfully: ${file.originalname}`,
        UserId.fromString(userId || 'anonymous'),
        'file',
        (fileEntity.id as unknown as { getValue?: () => string }).getValue
          ? (fileEntity.id as unknown as { getValue: () => string }).getValue()
          : (fileEntity.id as string),
        undefined,
        {
          fileName: file.originalname,
          fileSize: file.size,
          mimeType: file.mimetype,
          duration,
        },
      );

      return this.fileMapper.toResponse(fileEntity);
    } catch (error) {
      const duration = Date.now() - startTime;

      // Audit log for failed file upload
      this.auditLogService.logSecurity(
        'create',
        `File upload failed: ${file.originalname} - ${error.message}`,
        userId ? UserId.fromString(userId) : null,
        undefined,
        {
          fileName: file.originalname,
          fileSize: file.size,
          mimeType: file.mimetype,
          error: error.message,
          duration,
        },
        'error',
      );

      throw error;
    }
  }
}
