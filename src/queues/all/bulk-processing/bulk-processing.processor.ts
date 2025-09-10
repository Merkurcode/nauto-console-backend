/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable, Inject } from '@nestjs/common';
import { Processor } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { BaseProcessor } from '../../base/base-processor';
import { ILogger } from '@core/interfaces/logger.interface';
import { LOGGER_SERVICE } from '@shared/constants/tokens';
import { IBulkProcessingJobData, ModuleConfig } from './bulk-processing-config';
import { BulkProcessingService } from '../../../core/services/bulk-processing.service';
import { BulkProcessingType } from '@shared/constants/bulk-processing-type.enum';

@Processor(ModuleConfig.queue.name, ModuleConfig.processor)
@Injectable()
export class BulkProcessingProcessor extends BaseProcessor<IBulkProcessingJobData> {
  constructor(
    private readonly bulkProcessingService: BulkProcessingService,
    @Inject(LOGGER_SERVICE) logger: ILogger,
  ) {
    super(ModuleConfig, logger);
    this.logger.log(
      `Bulk processing processor initialized with concurrency: ${ModuleConfig.processor.concurrency}, ` +
        `max retries: ${ModuleConfig.jobs.attempts}`,
    );
  }

  async processJob(job: Job<IBulkProcessingJobData>): Promise<void> {
    const { jobType, requestId, companyId, userId, options } = job.data;

    // Check if job has been marked for cancellation
    await this.checkForCancellation(job);

    // Pass cancellation checker to the processing methods
    const cancellationChecker = () => this.checkForCancellation(job);

    this.logger.log(
      `Processing bulk job: ${jobType} for request ${requestId} ` +
        `(company: ${companyId}, user: ${userId})`,
    );

    this.logger.log(
      `Job received with options keys: ${options ? Object.keys(options) : 'no options'}`,
    );

    try {
      switch (jobType) {
        // If diff processing types shares same logic, then add them here...
        case BulkProcessingType.PRODUCT_CATALOG:
          await this.processExcelFile(job, cancellationChecker);
          break;

        case BulkProcessingType.CLEANUP_TEMP_FILES:
          await this.cleanupTempFiles(job, cancellationChecker);
          break;

        default:
          throw new Error(`Unknown bulk processing job type: ${jobType}`);
      }

      this.logger.log(`Completed bulk job: ${jobType} for request ${requestId} made by ${userId}`);
    } catch (error) {
      // Check if this is a cancellation error
      if (
        error instanceof Error &&
        (error.name === 'JobCancelledException' || error.message.includes('Job cancelled'))
      ) {
        this.logger.log(
          `Bulk job ${jobType} for request ${requestId} was cancelled during processing`,
        );
        // Mark error as non-retryable by setting a specific property
        const cancellationError = new Error(error.message);
        cancellationError.name = 'JobCancelledException';
        (cancellationError as any).shouldRetry = false;
        throw cancellationError;
      }

      this.logger.error(
        `Failed to process bulk job: ${jobType} for request ${requestId} made by ${userId}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error; // Re-throw to trigger retry mechanism
    }
  }

  private async checkForCancellation(job: Job<IBulkProcessingJobData>): Promise<void> {
    // Check the current job data for cancellation status
    // Note: In BullMQ, job data can be updated externally and the job instance reflects those changes
    if (job.data.cancelled) {
      // Log cancellation only once per job using a flag in job data
      if (!job.data.cancellationLogged) {
        this.logger.log(
          `Job ${job.id} for request ${job.data.requestId} has been cancelled. Stopping processing.`,
        );
        // Set flag to prevent duplicate logs
        job.data.cancellationLogged = true;
      }

      // Throw a specific error that indicates cancellation - this will be caught by onJobFailed
      const error = new Error(`Job cancelled at ${job.data.cancelledAt}`);
      error.name = 'JobCancelledException';
      throw error;
    }
  }

  private async processExcelFile(
    job: Job<IBulkProcessingJobData>,
    cancellationChecker: () => Promise<void>,
  ): Promise<void> {
    const { requestId, eventType, fileId, fileName, companyId, userId, options, metadata } =
      job.data;

    this.logger.log(`Processing Excel file with options: ${JSON.stringify(options, null, 2)}`);
    this.logger.log(`Job metadata: ${JSON.stringify(metadata, null, 2)}`);

    await this.bulkProcessingService.processExcelFile({
      requestId,
      eventType,
      fileId,
      fileName,
      companyId,
      userId,
      options,
      metadata,
      job, // Pass job for progress updates
      cancellationChecker, // Pass cancellation checker for periodic checks
    });
  }

  private async cleanupTempFiles(
    job: Job<IBulkProcessingJobData>,
    cancellationChecker: () => Promise<void>,
  ): Promise<void> {
    const { requestId, companyId, userId, options } = job.data;
    const filesToCleanup = options.filesToCleanup as string[];

    await this.bulkProcessingService.cleanupTempFiles({
      requestId,
      companyId,
      userId,
      filesToCleanup,
      job,
      cancellationChecker,
    });
  }

  protected getJobProgressInfo(job: Job<IBulkProcessingJobData>): string {
    const progress = job.progress || 0;
    const { jobType, requestId } = job.data;

    return `${jobType} (${requestId}): ${progress}%`;
  }

  protected async onJobActive(job: Job<IBulkProcessingJobData>): Promise<void> {
    const { jobType, requestId, companyId } = job.data;

    this.logger.log(
      `Started processing bulk job: ${jobType} for request ${requestId} in company ${companyId}`,
    );
  }

  protected async onJobCompleted(job: Job<IBulkProcessingJobData>, result: any): Promise<void> {
    const { jobType, requestId, companyId } = job.data;

    this.logger.log(
      `Completed bulk job: ${jobType} for request ${requestId} in company ${companyId}. ` +
        `Result: ${JSON.stringify(result).substring(0, 200)}...`,
    );
  }

  protected async onJobFailed(job: Job<IBulkProcessingJobData>, error: Error): Promise<void> {
    const { jobType, requestId, companyId, fileId } = job.data;

    // Check if this is a cancellation error
    if (error.name === 'JobCancelledException' || error.message.includes('Job cancelled')) {
      this.logger.log(`Job ${job.id} for request ${requestId} was cancelled and failed gracefully`);

      // Handle cancellation cleanup
      try {
        await this.bulkProcessingService.handleJobCancellation({
          requestId,
          companyId,
          fileId,
          jobType,
        });
      } catch (cancellationError) {
        this.logger.error(
          `Failed to handle job cancellation cleanup for request ${requestId}: ${cancellationError}`,
        );
      }

      return;
    }

    // Handle regular job failure
    this.logger.error(
      `Failed bulk job: ${jobType} for request ${requestId} in company ${companyId}. ` +
        `Error: ${error.message}`,
      error.stack,
    );

    // Ensure file status is restored when job fails
    try {
      await this.bulkProcessingService.handleJobFailure({
        requestId,
        companyId,
        fileId,
        error: error.message,
        jobType,
      });
    } catch (restoreError) {
      this.logger.error(
        `Failed to handle job failure cleanup for request ${requestId}: ${restoreError}`,
      );
    }
  }

  protected async onJobStalled(job: Job<IBulkProcessingJobData>): Promise<void> {
    const { jobType, requestId, companyId, fileId } = job.data;

    this.logger.warn(`Stalled bulk job: ${jobType} for request ${requestId}`);

    // Handle stalled job - may need to restore file status if job has been stalled for too long
    try {
      await this.bulkProcessingService.handleJobStalled({
        requestId,
        companyId,
        fileId,
        jobType,
      });
    } catch (stalledError) {
      this.logger.error(
        `Failed to handle stalled job cleanup for request ${requestId}: ${stalledError}`,
      );
    }
  }
}
