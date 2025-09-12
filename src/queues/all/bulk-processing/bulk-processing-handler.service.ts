import { Injectable, Scope } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '@infrastructure/logger/logger.service';
import { IBulkProcessingJobData, ModuleConfig } from './bulk-processing-config';
import { BulkProcessingService } from '../../../core/services/bulk-processing.service';
import { BulkProcessingType, ExcelJobs } from '@shared/constants/bulk-processing-type.enum';

@Injectable({ scope: Scope.REQUEST })
export class BulkProcessingHandlerService {
  private readonly logger: LoggerService;

  constructor(
    private readonly bulkProcessingService: BulkProcessingService,
    @InjectQueue(ModuleConfig.queue.name) private readonly queue: Queue,
    configService: ConfigService,
  ) {
    // Create a dedicated logger instance for the handler
    this.logger = new LoggerService(configService);
    this.logger.setContext(BulkProcessingHandlerService.name);
  }

  async handle(job: Job<IBulkProcessingJobData>): Promise<void> {
    const { jobType, requestId, companyId, userId, options } = job.data;

    this.logger.log(
      `Processing bulk job: ${jobType} for request ${requestId} ` +
        `(company: ${companyId}, user: ${userId})`,
    );

    this.logger.log(
      `Job received with options keys: ${options ? Object.keys(options) : 'no options'}`,
    );

    // Check for cancellation immediately before starting any processing
    const latestJob = await this.queue.getJob(job.id!);
    if (latestJob?.data.cancelled) {
      this.logger.log(
        `Job ${job.id} for request ${requestId} was already cancelled, throwing cancellation error to trigger failed event`,
      );
      // Throw cancellation error to trigger the failed event and handleJobCancellation
      const cancellationError = new Error('Job was cancelled before processing started');
      cancellationError.name = 'JobCancelledException';
      throw cancellationError;
    }

    try {
      switch (jobType) {
        case BulkProcessingType.CLEANUP_TEMP_FILES:
          await this.cleanupTempFiles(job);
          break;

        default:
          if (ExcelJobs?.has(jobType)) {
            await this.processExcelFile(job);
            break;
          }
          throw new Error(`Unknown bulk processing job type: ${jobType}`);
      }

      this.logger.log(`Completed bulk job: ${jobType} for request ${requestId} made by ${userId}`);
    } catch (error) {
      // Check if this is a cancellation error
      if (
        error instanceof Error &&
        (error.name === 'JobCancelledException' ||
          error.message.includes('Job cancelled') ||
          error.message.includes('Cannot start bulk processing request with status: CANCELLING'))
      ) {
        this.logger.log(
          `Bulk job ${jobType} for request ${requestId} was cancelled during processing`,
        );
        // Mark error as non-retryable by setting a specific property
        const cancellationError = new Error(error.message);
        cancellationError.name = 'JobCancelledException';
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

  private async processExcelFile(job: Job<IBulkProcessingJobData>): Promise<void> {
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
      cancellationChecker: () => this.checkForCancellation(job), // Pass cancellation checker for periodic checks
    });
  }

  private async cleanupTempFiles(job: Job<IBulkProcessingJobData>): Promise<void> {
    const { requestId, companyId, userId, options } = job.data;
    const filesToCleanup = options.filesToCleanup as string[];

    await this.bulkProcessingService.cleanupTempFiles({
      requestId,
      companyId,
      userId,
      filesToCleanup,
      job,
      //cancellationChecker: () => this.checkForCancellation(job),
    });
  }

  private async checkForCancellation(job: Job<IBulkProcessingJobData>): Promise<void> {
    // Validate job ID exists
    if (!job.id) {
      this.logger.warn('Cannot check cancellation: job.id is undefined');

      return;
    }

    // Get fresh job state from Redis
    const fresh = await this.queue.getJob(job.id);
    if (!fresh) return;

    if (fresh.data.cancelled) {
      // Avoid double log in this process
      if (!job.data.cancellationLogged && !fresh.data.cancellationLogged) {
        this.logger.log(
          `Job ${fresh.id} for request ${fresh.data.requestId} has been cancelled. Stopping processing.`,
        );

        // Write ONCE to Redis using the worker instance
        await job.updateData({
          ...fresh.data, // part of the freshest
          cancellationLogged: true, // and mark the flag
        });

        // Keep both local copies synchronized for this process
        job.data.cancellationLogged = true;
        fresh.data.cancellationLogged = true;
      }

      const error = new Error(`Job cancelled at ${job.data.cancelledAt}`);
      error.name = 'JobCancelledException';
      throw error;
    }
  }
}
