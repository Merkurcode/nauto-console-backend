import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable, Inject, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { StorageService } from '@core/services/storage.service';
import { AUDIT_LOG_SERVICE } from '@shared/constants/tokens';
import { AuditLogService } from '@core/services/audit-log.service';
import { UserId } from '@core/value-objects/user-id.vo';

export class DeleteFileCommand {
  constructor(
    public readonly fileId: string,
    public readonly userId?: string,
  ) {}
}

@Injectable()
@CommandHandler(DeleteFileCommand)
export class DeleteFileCommandHandler implements ICommandHandler<DeleteFileCommand, void> {
  constructor(
    private readonly storageService: StorageService,
    @Inject(AUDIT_LOG_SERVICE)
    private readonly auditLogService: AuditLogService,
  ) {}

  async execute(command: DeleteFileCommand): Promise<void> {
    const startTime = Date.now();
    const { fileId, userId } = command;

    try {
      const file = await this.storageService.getFileById(fileId);
      if (!file) {
        const duration = Date.now() - startTime;

        // Audit log for file not found
        this.auditLogService.logSecurity(
          'delete',
          `Attempted to delete non-existent file: ${fileId}`,
          userId ? UserId.fromString(userId) : null,
          undefined,
          {
            fileId,
            userId,
            error: 'File not found',
            duration,
          },
          'warn',
        );

        throw new NotFoundException('File not found');
      }

      // Check if the user has permission to delete the file
      if (userId && file.userId && file.userId !== userId) {
        const duration = Date.now() - startTime;

        // Audit log for unauthorized deletion attempt
        this.auditLogService.logSecurity(
          'delete',
          `Unauthorized file deletion attempt: ${file.filename}`,
          UserId.fromString(userId),
          undefined,
          {
            fileId,
            fileName: file.filename,
            fileOwner: file.userId,
            attemptingUser: userId,
            error: 'Unauthorized access',
            duration,
          },
          'warn',
        );

        throw new UnauthorizedException('You do not have permission to delete this file');
      }

      await this.storageService.deleteFile(fileId);
      const duration = Date.now() - startTime;

      // Audit log for successful file deletion
      this.auditLogService.logUserAction(
        'delete',
        `File deleted successfully: ${file.filename}`,
        userId ? UserId.fromString(userId) : null,
        'file',
        fileId,
        {
          fileName: file.filename,
          fileSize: file.size,
          mimeType: file.mimeType,
          duration,
        },
        undefined,
      );
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof UnauthorizedException) {
        throw error; // These are already logged above
      }

      const duration = Date.now() - startTime;

      // Audit log for unexpected deletion failure
      this.auditLogService.logSecurity(
        'delete',
        `File deletion failed unexpectedly: ${fileId} - ${error.message}`,
        userId ? UserId.fromString(userId) : null,
        undefined,
        {
          fileId,
          userId,
          error: error.message,
          duration,
        },
        'error',
      );

      throw error;
    }
  }
}
