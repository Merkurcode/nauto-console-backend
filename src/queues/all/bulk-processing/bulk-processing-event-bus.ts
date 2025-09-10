import { Injectable, Inject } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { BaseEventBus } from '../../base/base-event-bus';
import { IPublishOptions } from '../../types';
import { HealthService } from '../../health/health-checker.service';
import { ILogger } from '@core/interfaces/logger.interface';
import { LOGGER_SERVICE } from '@shared/constants/tokens';
import { IBulkProcessingJobData, ModuleConfig } from './bulk-processing-config';
import {
  BulkProcessingEventType,
  BulkProcessingType,
} from '@shared/constants/bulk-processing-type.enum';
import { IBulkProcessingFlatOptions } from '@core/interfaces/bulk-processing-options.interface';

@Injectable()
export class BulkProcessingEventBus extends BaseEventBus<IBulkProcessingJobData> {
  constructor(
    @InjectQueue(ModuleConfig.queue.name) queue: Queue,
    @Inject(LOGGER_SERVICE) logger: ILogger,
    @Inject() healthService?: HealthService,
  ) {
    super(ModuleConfig, queue, logger, healthService);
  }

  protected getJobName(data: IBulkProcessingJobData): string {
    return data.jobType || 'UNKNOWN_BULK_JOB';
  }

  protected prepareJobData(data: IBulkProcessingJobData, jobId: string): IBulkProcessingJobData {
    const now = Date.now();
    const retryUntil = now + (this.module.queue.retryWindowMs || 6 * 60 * 60 * 1000); // 6 hours

    return {
      ...data,
      timestamp: now,
      retryUntil,
      metadata: {
        ...data.metadata,
        jobId,
        queueName: this.module.queue.name,
        enqueuedAt: new Date(now).toISOString(),
      },
    };
  }

  /**
   * Queue cleanup job for temporary files
   */
  async queueCleanupJob(
    data: {
      requestId: string;
      fileId: string;
      companyId: string;
      userId: string;
      filesToCleanup: string[];
      metadata?: Record<string, unknown>;
    },
    opts?: IPublishOptions,
  ): Promise<{ jobId: string; status: 'queued' }> {
    const jobData: IBulkProcessingJobData = {
      jobType: BulkProcessingType.CLEANUP_TEMP_FILES,
      requestId: data.requestId,
      eventType: BulkProcessingEventType.CLEANUP_TEMP_FILES,
      fileId: data.fileId,
      fileName: 'cleanup-job',
      companyId: data.companyId,
      userId: data.userId,
      options: {
        filesToCleanup: data.filesToCleanup,
      } as IBulkProcessingFlatOptions,
      metadata: data.metadata,
      timestamp: 0,
      retryUntil: 0,
    };

    return this.publish(jobData, opts);
  }

  /**
   * Queue generic bulk processing job for extensibility
   */
  async queueGenericBulkJob(
    jobType: BulkProcessingType,
    data: {
      requestId: string;
      eventType: BulkProcessingEventType;
      fileId: string;
      fileName: string;
      companyId: string;
      userId: string;
      options: IBulkProcessingFlatOptions;
      metadata?: Record<string, unknown>;
    },
    opts?: IPublishOptions,
  ): Promise<{ jobId: string; status: 'queued' }> {
    const jobData: IBulkProcessingJobData = {
      jobType,
      requestId: data.requestId,
      eventType: data.eventType,
      fileId: data.fileId,
      fileName: data.fileName,
      companyId: data.companyId,
      userId: data.userId,
      options: data.options as IBulkProcessingFlatOptions,
      metadata: data.metadata,
      timestamp: 0,
      retryUntil: 0,
    };

    return this.publish(jobData, opts);
  }

  /**
   * Get bulk processing job statistics
   */
  async getBulkProcessingStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    const counts = await this.queue.getJobCounts(
      'waiting',
      'active',
      'completed',
      'failed',
      'delayed',
    );

    return {
      waiting: counts.waiting || 0,
      active: counts.active || 0,
      completed: counts.completed || 0,
      failed: counts.failed || 0,
      delayed: counts.delayed || 0,
    };
  }
}
