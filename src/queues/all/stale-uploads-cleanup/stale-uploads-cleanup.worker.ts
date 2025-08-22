import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Inject } from '@nestjs/common';
import { MultipartUploadService } from '@core/services/multipart-upload.service';
import { ILogger } from '@core/interfaces/logger.interface';
import { LOGGER_SERVICE } from '@shared/constants/tokens';

@Processor('stale-uploads-cleanup', { concurrency: 1 })
export class StaleUploadsCleanupWorker extends WorkerHost {
  constructor(
    private readonly multipartUploadService: MultipartUploadService,
    @Inject(LOGGER_SERVICE) private readonly logger: ILogger,
  ) {
    super();
    this.logger.setContext(StaleUploadsCleanupWorker.name);
  }

  async process(
    job: Job<{ inactivityThresholdMinutes?: number }>,
  ): Promise<{ cleanedCount: number; errors: number }> {
    const inactivityThreshold = job.data?.inactivityThresholdMinutes ?? 15;

    this.logger.debug(`Starting cleanup of uploads inactive for ${inactivityThreshold}+ minutes`);

    try {
      const cleanedCount =
        await this.multipartUploadService.cleanupExpiredUploads(inactivityThreshold);

      this.logger.log(`Stale uploads cleanup completed: ${cleanedCount} uploads cleaned`);

      return { cleanedCount, errors: 0 };
    } catch (error) {
      this.logger.error(`Stale uploads cleanup failed: ${(error as Error).message}`);

      return { cleanedCount: 0, errors: 1 };
    }
  }
}
