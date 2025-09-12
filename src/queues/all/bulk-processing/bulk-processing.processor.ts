import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { ModuleRef, ContextIdFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '@infrastructure/logger/logger.service';
import { IBulkProcessingJobData, ModuleConfig } from './bulk-processing-config';
import { BulkProcessingHandlerService } from './bulk-processing-handler.service';
import { BulkProcessingService } from '../../../core/services/bulk-processing.service';

@Processor(ModuleConfig.queue.name, ModuleConfig.processor)
@Injectable()
export class BulkProcessingProcessor extends WorkerHost {
  private readonly logger: LoggerService;

  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly configService: ConfigService,
  ) {
    super();
    // Create a dedicated singleton logger instance for the processor
    this.logger = new LoggerService(configService);
    this.logger.setContext(BulkProcessingProcessor.name);
    this.logger.log(
      `Bulk processing processor initialized with concurrency: ${ModuleConfig.processor.concurrency}, ` +
        `max retries: ${ModuleConfig.jobs.attempts}`,
    );
  }

  private async getBulkProcessingService(): Promise<BulkProcessingService | null> {
    try {
      return await this.moduleRef.resolve(BulkProcessingService, undefined, {
        strict: false,
      });
    } catch (error) {
      this.logger.error('Failed to resolve BulkProcessingService', error);

      return null;
    }
  }

  private getJobProgressInfo(job: Job<IBulkProcessingJobData>): string {
    const progress = job.progress || 0;
    const { jobType, requestId } = job.data;

    return `${jobType} (${requestId}): ${progress}%`;
  }

  async process(job: Job<IBulkProcessingJobData>): Promise<void> {
    // 1) Create a contextId "per job"
    const contextId = ContextIdFactory.create();

    // 2) Register the "request" (the job itself as the request context)
    this.moduleRef.registerRequestByContextId({ job }, contextId);

    // 3) Resolve the request-scoped handler within that context
    const handler = await this.moduleRef.resolve(BulkProcessingHandlerService, contextId, {
      strict: false,
    });

    // 4) Execute the real logic in the request-scoped handler
    return handler.handle(job);
  }

  @OnWorkerEvent('progress')
  async onJobProgress(job: Job<IBulkProcessingJobData>): Promise<void> {
    const progressInfo = this.getJobProgressInfo(job);
    this.logger.debug(`Bulk processing progress: ${progressInfo}`);
  }

  @OnWorkerEvent('active')
  async onJobActive(job: Job<IBulkProcessingJobData>): Promise<void> {
    const { jobType, requestId, companyId } = job.data;

    this.logger.log(
      `Started processing bulk job: ${jobType} for request ${requestId} in company ${companyId}`,
    );
  }

  @OnWorkerEvent('completed')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async onJobCompleted(job: Job<IBulkProcessingJobData>, result: any): Promise<void> {
    const { jobType, requestId, companyId } = job.data;

    const resultStr = result ? JSON.stringify(result) : 'undefined';
    this.logger.log(
      `Completed bulk job: ${jobType} for request ${requestId} in company ${companyId}. ` +
        `Result: ${resultStr.substring(0, 200)}...`,
    );
  }

  @OnWorkerEvent('failed')
  async onJobFailed(job: Job<IBulkProcessingJobData>, error: Error): Promise<void> {
    const { jobType, requestId, companyId, fileId, eventType } = job.data;

    let bulkProcessingService;

    try {
      bulkProcessingService = await this.getBulkProcessingService();
    } catch (e) {
      this.logger.error(
        `Failed to handle failure job for request ${requestId}: ${e?.message || e}`,
      );
    }

    // Check if this is a cancellation error
    if (
      error.name === 'JobCancelledException' ||
      error.message.includes('Job cancelled') ||
      error.message.includes('Cannot start bulk processing request with status: CANCELLING')
    ) {
      this.logger.log(`Job ${job.id} for request ${requestId} was cancelled and failed gracefully`);

      // Handle cancellation cleanup using dynamic service resolution
      try {
        if (bulkProcessingService) {
          await bulkProcessingService.handleJobCancellation({
            requestId,
            companyId,
            fileId,
            jobType,
            eventType,
          });
        }
      } catch (cancellationError) {
        this.logger.error(
          `Failed to handle job cancellation cleanup for request ${requestId}: ${cancellationError?.message || cancellationError}`,
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

    // Ensure file status is restored when job fails using dynamic service resolution
    try {
      if (bulkProcessingService) {
        await bulkProcessingService.handleJobFailure({
          requestId,
          companyId,
          fileId,
          error: error.message,
          jobType,
        });
      }
    } catch (restoreError) {
      this.logger.error(
        `Failed to handle job failure cleanup for request ${requestId}: ${restoreError?.message || restoreError}`,
      );
    }
  }

  @OnWorkerEvent('stalled')
  async onJobStalled(job: Job<IBulkProcessingJobData>): Promise<void> {
    const { jobType, requestId, companyId, fileId } = job.data;

    this.logger.warn(`Stalled bulk job: ${jobType} for request ${requestId}`);

    // Handle stalled job using dynamic service resolution
    try {
      const bulkProcessingService = await this.getBulkProcessingService();
      if (bulkProcessingService) {
        await bulkProcessingService.handleJobStalled({
          requestId,
          companyId,
          fileId,
          jobType,
        });
      }
    } catch (stalledError) {
      this.logger.error(
        `Failed to handle stalled job cleanup for request ${requestId}: ${stalledError?.message || stalledError}`,
      );
    }
  }
}
