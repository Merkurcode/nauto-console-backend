import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { IConcurrencyService } from '@core/repositories/concurrency.service.interface';
import { IFileRepository } from '@core/repositories/file.repository.interface';
import { MultipartUploadService } from '@core/services/multipart-upload.service';
import { CONCURRENCY_SERVICE, FILE_REPOSITORY } from '@shared/constants/tokens';
import { FileStatus } from '@core/value-objects/file-status.vo';

export class ClearUserConcurrencySlotsCommand {
  constructor(public readonly userId: string) {}
}

@CommandHandler(ClearUserConcurrencySlotsCommand)
export class ClearUserConcurrencySlotsHandler
  implements ICommandHandler<ClearUserConcurrencySlotsCommand>
{
  private readonly logger = new Logger(ClearUserConcurrencySlotsHandler.name);

  constructor(
    @Inject(CONCURRENCY_SERVICE)
    private readonly concurrencyService: IConcurrencyService,
    @Inject(FILE_REPOSITORY)
    private readonly fileRepository: IFileRepository,
    private readonly multipartUploadService: MultipartUploadService,
  ) {}

  async execute(command: ClearUserConcurrencySlotsCommand): Promise<void> {
    const { userId } = command;

    this.logger.log({
      message: 'Starting user concurrency cleanup',
      userId,
    });

    // Step 1: Find all active uploads for this user
    const uploadingFiles = await this.fileRepository.findByUserIdAndStatus(
      userId,
      FileStatus.uploading(),
    );

    this.logger.log({
      message: 'Found active uploads to abort',
      userId,
      count: uploadingFiles.length,
    });

    // Step 2: Abort all active multipart uploads (each in its own transaction)
    let abortedCount = 0;
    let errorCount = 0;

    for (const file of uploadingFiles) {
      try {
        if (file.uploadId) {
          this.logger.debug({
            message: 'Aborting upload with individual transaction',
            fileId: file.id.toString(),
            uploadId: file.uploadId.toString(),
          });

          // Each abort is now wrapped in its own transaction with rollback logic
          // If storage fails but object exists, the entire operation rolls back
          // This prevents orphaned records and maintains consistency
          await this.multipartUploadService.abortUpload(
            userId,
            file.id.toString(),
            true,
            'User concurrency slots cleared by admin',
          );
          abortedCount++;
        }
      } catch (error) {
        errorCount++;
        this.logger.error({
          message: 'Failed to abort upload - transaction rolled back for consistency',
          fileId: file.id.toString(),
          error: error instanceof Error ? error.message : 'Unknown error',
          note: 'File remains in database if storage object exists to prevent orphaning',
        });
      }
    }

    // Step 3: Only clear concurrency slots if all aborts were successful
    // This prevents negative concurrency counts from partial failures
    if (errorCount === 0 && abortedCount === uploadingFiles.length) {
      await this.concurrencyService.clearUserSlots(userId);
      this.logger.log({
        message: 'Cleared user concurrency slots after successful aborts',
        userId,
        abortedCount,
      });
    } else {
      const errorMessage = `Failed to abort ${errorCount} out of ${uploadingFiles.length} uploads. Concurrency slots not cleared to prevent negative counts.`;
      this.logger.error({
        message: 'Abort operation failed - throwing error',
        userId,
        expectedAborts: uploadingFiles.length,
        successfulAborts: abortedCount,
        errors: errorCount,
        errorMessage,
      });

      throw new Error(errorMessage);
    }

    this.logger.log({
      message: 'User concurrency cleanup completed successfully',
      userId,
      totalFiles: uploadingFiles.length,
      abortedUploads: abortedCount,
      errors: errorCount,
      concurrencySlotsCleared: true,
    });
  }
}
