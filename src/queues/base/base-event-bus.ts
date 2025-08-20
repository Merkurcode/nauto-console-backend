/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable, HttpException, HttpStatus, Inject } from '@nestjs/common';
import { Queue, JobsOptions } from 'bullmq';
import { createHash } from 'crypto';
import { IPublishOptions, IQueueModuleConfig, IBaseJobData } from '../types';
import { HealthService } from '../health/health-checker.service';
import { ILogger } from '@core/interfaces/logger.interface';
import { LOGGER_SERVICE } from '@shared/constants/tokens';

export interface IQueueStats {
  backlog: number;
  active: number;
  accepting: boolean;
}

@Injectable()
export abstract class BaseEventBus<T = Record<string, any>> {
  protected readonly logger: ILogger;
  protected readonly module: Required<IQueueModuleConfig>;

  constructor(
    module: IQueueModuleConfig,
    protected readonly queue: Queue,
    @Inject(LOGGER_SERVICE) logger: ILogger,
    protected readonly healthService: HealthService,
  ) {
    this.module = { ...module };
    this.logger = logger.setContext(`${this.constructor.name}:${this.module.queue.name}`);
  }

  protected abstract getJobName(data: T): string;
  protected abstract prepareJobData(data: T, jobId: string): IBaseJobData;

  async publish(data: T, opts?: IPublishOptions): Promise<{ jobId: string; status: 'queued' }> {
    this.enforceHealthOrThrow();

    const jobName = this.getJobName(data);
    const jobId = this.generateJobId(data, jobName, opts);
    const jobData = this.prepareJobData(data, jobId);
    const jobOpts = this.buildJobOptions(opts, jobId);

    await this.queue.add(jobName, jobData, jobOpts);
    this.logger.debug(`Job published: ${jobName} (${jobId})`);

    return { jobId, status: 'queued' };
  }

  async publishMany(
    items: T[],
    opts?: IPublishOptions,
  ): Promise<{ jobIds: string[]; status: 'queued' }> {
    this.enforceHealthOrThrow();

    const jobs = items.map(data => {
      const jobName = this.getJobName(data);
      const jobId = this.generateJobId(data, jobName, opts);

      return {
        name: jobName,
        data: this.prepareJobData(data, jobId),
        opts: this.buildJobOptions(opts, jobId),
      };
    });

    const createdJobs = await this.queue.addBulk(jobs);
    const jobIds = createdJobs.map(job => job.id!);
    this.logger.debug(`Bulk published ${jobIds.length} jobs`);

    return { jobIds, status: 'queued' };
  }

  async publishBatch(
    items: T[],
    opts?: IPublishOptions,
  ): Promise<{ jobIds: string[]; status: 'queued' }> {
    return this.publishMany(items, opts);
  }

  publishFast(data: T, opts?: IPublishOptions): void {
    setImmediate(async () => {
      try {
        await this.publish(data, opts);
      } catch (error) {
        this.logger.error(
          `Fast publish failed: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    });
  }

  async getStats(): Promise<IQueueStats> {
    const counts = await this.queue.getJobCounts('waiting', 'delayed', 'active');
    const waiting = counts.waiting ?? 0;
    const delayed = counts.delayed ?? 0;
    const active = counts.active ?? 0;
    const backlog = waiting + delayed;

    return {
      backlog,
      active,
      accepting: this.healthService.isAccepting(this.queue.name),
    };
  }

  protected enforceHealthOrThrow(): void {
    if (!this.healthService.isAccepting(this.queue.name)) {
      throw new HttpException('Queue unhealthy', HttpStatus.SERVICE_UNAVAILABLE);
    }
  }

  protected buildJobOptions(opts?: IPublishOptions, jobId?: string): JobsOptions {
    return {
      attempts: opts?.attempts ?? this.module.jobs.attempts,
      backoff: opts?.backoff ?? this.module.jobs.backoff,
      removeOnComplete: opts?.removeOnComplete ?? this.module.jobs.removeOnComplete,
      removeOnFail: opts?.removeOnFail ?? this.module.jobs.removeOnFail,
      delay: opts?.delay ?? this.module.jobs.delay,
      priority: opts?.priority ?? this.module.jobs.priority,
      lifo: opts?.lifo ?? this.module.jobs.lifo,
      jobId,
    };
  }

  protected generateJobId(data: T, jobName: string, opts?: IPublishOptions): string {
    if (opts?.jobId) return opts.jobId;
    if (opts?.useIdempotency) return this.createDeterministicJobId(data, jobName);

    return `${jobName}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  protected createDeterministicJobId(data: T, jobName: string): string {
    try {
      const normalized = this.sortDeep(data);
      const str = JSON.stringify(normalized);
      const hash = createHash('sha256').update(str).digest('hex').slice(0, 16);

      return `${jobName}-${hash}`;
    } catch {
      return `${jobName}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    }
  }

  private sortDeep(obj: any): any {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(item => this.sortDeep(item));

    const sorted: any = {};
    Object.keys(obj)
      .sort()
      .forEach(key => {
        sorted[key] = this.sortDeep(obj[key]);
      });

    return sorted;
  }
}
