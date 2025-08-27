import { Inject } from '@nestjs/common';
import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { IBaseJobData, IQueueModuleConfig } from '../types';
import { ILogger } from '@core/interfaces/logger.interface';
import { LOGGER_SERVICE } from '@shared/constants/tokens';

/**
 * Clase base para processors de BullMQ.
 * IMPORTANTE: La clase que extienda BaseProcessor DEBE:
 * 1. Tener el decorador @Processor('queue-name')
 * 2. Implementar los decoradores @OnWorkerEvent si quiere manejar eventos
 *
 * Ejemplo:
 * @Processor('mi-cola')
 * export class MiProcessor extends BaseProcessor<MiTipoDatos> {
 *   @OnWorkerEvent('failed')
 *   async onFailed(job: Job, err: Error) {
 *     await this.handleFailedJob(job, err);
 *   }
 * }
 */
export abstract class BaseProcessor<T = IBaseJobData> extends WorkerHost {
  protected readonly logger: ILogger;
  protected readonly module: Required<IQueueModuleConfig>;

  constructor(module: IQueueModuleConfig, @Inject(LOGGER_SERVICE) logger: ILogger) {
    super();
    this.module = { ...module };
    this.logger = logger.setContext((this as any).constructor?.name ?? BaseProcessor.name);
  }

  abstract processJob(job: Job<T>): Promise<void>;

  async process(job: Job<T>): Promise<void> {
    if (job.finishedOn) {
      this.logger.warn(`Job ${job.id} already completed, skipping...`);

      return;
    }

    const start = Date.now();
    const retryUntil = this.getRetryDeadline(job);

    try {
      await this.processJob(job);
      this.logger.debug(`✓ Job ${job.id} in ${Date.now() - start}ms`);
    } catch (err) {
      await this.handleJobError(job, err, retryUntil);
    }
  }

  protected getRetryDeadline(job: Job<T>): number {
    const jobData = job.data as IBaseJobData;

    return (
      jobData?.retryUntil ??
      (job.timestamp ?? Date.now()) + (this.module.queue.retryWindowMs ?? 6 * 60 * 60 * 1000)
    );
  }

  protected async handleJobError(job: Job<T>, err: unknown, retryUntil: number): Promise<void> {
    const msg = err instanceof Error ? err.message : String(err);

    if (this.isRedisTimeoutError(err)) {
      this.logger.warn(`Redis timeout for job ${job.id}, will retry`);
      throw err;
    }

    if (this.isPermanentError(err)) {
      await job.discard();
      this.logger.warn(`Non-retryable job ${job.id}: ${msg}`);
      throw err;
    }

    if (Date.now() > retryUntil) {
      await job.discard();
      this.logger.warn(`Retry window expired for job ${job.id}. No more retries.`);
      throw err;
    }

    this.logger.error(
      `✗ Job ${job.id} failed (attempt ${job.attemptsMade}/${job.opts?.attempts ?? '?'}): ${msg}`,
    );
    throw err;
  }

  protected isPermanentError(err: unknown): boolean {
    const errorObj = err as Error;
    const msg = errorObj?.message ? String(errorObj.message) : String(err);

    return /ValidationError|SchemaError|NonRetryable/i.test(msg);
  }

  protected isRedisTimeoutError(err: unknown): boolean {
    const errorObj = err as Error;
    const msg = errorObj?.message ? String(errorObj.message) : String(err);

    return /Command timed out|Connection timeout|Redis timeout/i.test(msg);
  }

  // Métodos helper para manejar eventos (sin decoradores)
  // Las clases hijas deben implementar los decoradores @OnWorkerEvent y llamar estos métodos

  protected async handleFailedJob(job: Job<T> | undefined, err: Error): Promise<void> {
    if (!job) return;
    this.logger.error(`Job ${job.id} failed: ${err?.message}`);
  }

  protected async handleCompletedJob(job: Job<T>): Promise<void> {
    const started = job.processedOn ?? job.timestamp ?? Date.now();
    this.logger.debug(`Completed job ${job.id} in ${Date.now() - started}ms`);
  }

  protected async handleStalledJob(job: Job<T>): Promise<void> {
    this.logger.warn(`Job ${job?.id} stalled; attemptsMade=${job?.attemptsMade}`);

    if (
      job &&
      job.opts?.attempts &&
      job.attemptsMade &&
      this.module.processor.maxStalledCount &&
      job.attemptsMade >= this.module.processor.maxStalledCount
    ) {
      this.logger.error(`Job ${job.id} stalled too many times, discarding...`);
      try {
        await job.discard();
      } catch (err) {
        const error = err as Error;
        this.logger.error(`Failed to discard stalled job ${job.id}: ${error?.message}`);
      }
    }
  }

  protected async handleWorkerError(err: Error): Promise<void> {
    this.logger.error(`Worker error: ${err?.message}`, err?.stack);
  }
}
