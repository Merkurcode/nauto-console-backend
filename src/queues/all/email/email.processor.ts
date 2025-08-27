// General
import { Processor, OnWorkerEvent } from '@nestjs/bullmq';
import { IEventHandler } from '@nestjs/cqrs';
import { Inject, OnModuleDestroy } from '@nestjs/common';
import { Job } from 'bullmq';
import { GenericEventProcessor } from 'src/queues/processors/generic-event-processor';
import { LOGGER_SERVICE } from '@shared/constants/tokens';
import { ILogger } from '@core/interfaces/logger.interface';
import { IEventJobData } from 'src/queues/types';

import { ModuleConfig, EmailRateLimitConfig } from './email-config';

// Email queue metrics tracking
interface IEmailQueueMetrics {
  totalProcessed: number;
  totalFailed: number;
  totalCompleted: number;
  averageProcessingTime: number;
  rateLimitHits: number;
  lastProcessedAt: number;
  emailsPerMinute: number;
  smtpErrors: number;
}

// Info estructurada para límites (Resend y genérico)
type RateInfo = {
  provider?: 'resend' | 'other';
  rateLimited: boolean;
  retryAfterMs?: number;
  remaining?: number;
  resetAt?: number; // epoch ms
  status?: number;
  reason?: string;
};

@Processor(ModuleConfig.queue.name, ModuleConfig.processor)
export class AuthEmailEventProcessor extends GenericEventProcessor implements OnModuleDestroy {
  private metrics: IEmailQueueMetrics = {
    totalProcessed: 0,
    totalFailed: 0,
    totalCompleted: 0,
    averageProcessingTime: 0,
    rateLimitHits: 0,
    lastProcessedAt: 0,
    emailsPerMinute: 0,
    smtpErrors: 0,
  };

  private processingTimes: number[] = [];
  private emailTimestamps: number[] = [];
  private metricsInterval: NodeJS.Timeout | null = null;

  constructor(
    @Inject('EVENT_HANDLERS') eventHandlers: IEventHandler<unknown>[],
    @Inject(LOGGER_SERVICE) logger: ILogger,
  ) {
    super(ModuleConfig, logger);
    this.eventHandlers = eventHandlers;

    // Log metrics every 5 minutes; guard to clear later
    this.metricsInterval = setInterval(() => this.logMetrics(), 5 * 60 * 1000);
    this.metricsInterval?.unref?.();
  }

  onModuleDestroy(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
  }

  // ⬇️⬇️⬇️  DECORADORES DE EVENTOS DEL WORKER  ⬇️⬇️⬇️

  @OnWorkerEvent('failed')
  async onFailed(job: Job<IEventJobData> | undefined, err: Error) {
    this.metrics.totalFailed++;
    this.metrics.totalProcessed++;

    const msg = err?.message ?? '';
    if (/smtp|mail/i.test(msg)) this.metrics.smtpErrors++;

    const rateInfo = this.parseRateInfo(err);
    if (rateInfo.rateLimited) this.metrics.rateLimitHits++;

    this.logger.warn({
      message: 'Email job failed',
      jobId: job?.id,
      attemptsMade: job?.attemptsMade,
      totalFailed: this.metrics.totalFailed,
      rateLimitHits: this.metrics.rateLimitHits,
      error: msg,
      rateInfo,
    });

    await this.handleFailedJob(job, err);
  }

  @OnWorkerEvent('completed')
  async onCompleted(job: Job<IEventJobData>) {
    const now = Date.now();
    const base = job.processedOn ?? job.timestamp ?? now;
    const processingTime = Math.max(0, now - base);

    this.metrics.totalCompleted++;
    this.metrics.totalProcessed++;
    this.metrics.lastProcessedAt = now;

    this.processingTimes.push(processingTime);
    if (this.processingTimes.length > 100) this.processingTimes.shift();

    const sum = this.processingTimes.reduce((acc, t) => acc + t, 0);
    this.metrics.averageProcessingTime = this.processingTimes.length
      ? sum / this.processingTimes.length
      : 0;

    this.emailTimestamps.push(now);
    this.emailTimestamps = this.emailTimestamps.filter(ts => now - ts < 60_000);
    this.metrics.emailsPerMinute = this.emailTimestamps.length;

    this.logger.debug({
      message: 'Email job completed',
      jobId: job.id,
      processingTimeMs: processingTime,
      avgProcessingTimeMs: Math.round(this.metrics.averageProcessingTime),
      emailsPerMinute: this.metrics.emailsPerMinute,
      totalCompleted: this.metrics.totalCompleted,
    });

    await this.handleCompletedJob(job);
  }

  @OnWorkerEvent('stalled')
  async onStalled(job: Job<IEventJobData>) {
    this.logger.warn({
      message: 'Email job stalled',
      jobId: job.id,
      attemptsMade: job.attemptsMade,
      maxAttempts: job.opts?.attempts,
      metrics: this.getMetricsSummary(),
    });

    await this.handleStalledJob(job);
  }

  // Evento de error del worker (no necesariamente atado a un job concreto)
  @OnWorkerEvent('error')
  async onWorkerError(err: Error) {
    this.logger.error({
      message: 'Email worker error',
      error: err?.message ?? String(err),
      metrics: this.getMetricsSummary(),
    });

    await this.handleWorkerError(err);
  }

  // ================== helpers / métricas ==================

  getMetrics(): IEmailQueueMetrics {
    return { ...this.metrics };
  }

  private getMetricsSummary() {
    const total = this.metrics.totalProcessed;
    const successRate = total > 0 ? (this.metrics.totalCompleted / total) * 100 : 0;

    const providerMaxPerMinute =
      EmailRateLimitConfig?.providers?.resend?.maxPerMinute ?? Number.POSITIVE_INFINITY;

    return {
      totalProcessed: total,
      totalCompleted: this.metrics.totalCompleted,
      totalFailed: this.metrics.totalFailed,
      successRate: `${successRate.toFixed(1)}%`,
      avgProcessingTimeMs: Math.round(this.metrics.averageProcessingTime),
      emailsPerMinute: this.metrics.emailsPerMinute,
      rateLimitHits: this.metrics.rateLimitHits,
      smtpErrors: this.metrics.smtpErrors,
      withinRateLimit: this.metrics.emailsPerMinute <= providerMaxPerMinute,
    };
  }

  private logMetrics() {
    if (this.metrics.totalProcessed === 0) return;

    const summary = this.getMetricsSummary();
    this.logger.log({
      message: 'Email Queue Metrics Report',
      ...summary,
    });

    const providerMaxPerMinute =
      EmailRateLimitConfig?.providers?.resend?.maxPerMinute ?? Number.POSITIVE_INFINITY;

    if (providerMaxPerMinute !== Number.POSITIVE_INFINITY) {
      const warnThreshold = providerMaxPerMinute * 0.8;
      if (this.metrics.emailsPerMinute > warnThreshold) {
        this.logger.warn(
          `Approaching email rate limit: ${this.metrics.emailsPerMinute}/${providerMaxPerMinute} emails/min`,
        );
      }
    }

    const failureRate =
      this.metrics.totalProcessed > 0
        ? (this.metrics.totalFailed / this.metrics.totalProcessed) * 100
        : 0;

    if (failureRate > 20) {
      this.logger.warn(
        `High email failure rate: ${failureRate.toFixed(1)}% (${this.metrics.totalFailed}/${this.metrics.totalProcessed})`,
      );
    }
  }

  /**
   * Extrae información de rate limit específica de Resend (y genérica).
   */
  private parseRateInfo(raw: unknown) {
    const info: RateInfo = { rateLimited: false };

    const err = raw as any;
    const status = err?.status ?? err?.statusCode ?? err?.response?.status;
    const headers = err?.headers ?? err?.response?.headers ?? {};
    const body = err?.body ?? err?.response?.data ?? err?.response?.body ?? err?.data;
    const message: string = err?.message ?? '';

    if (status === 429) {
      info.rateLimited = true;
      info.status = 429;
    }

    const name: string = err?.name ?? '';
    const isResend =
      /resend/i.test(name) || /resend/i.test(err?.provider) || /resend/i.test(message);
    if (isResend) info.provider = 'resend';

    const errorType: string | undefined = body?.error?.type;
    if (/rate[_-]?limit/i.test(errorType ?? '')) {
      info.rateLimited = true;
      info.reason = errorType;
    }

    const retryAfterHeader = headers['retry-after'] ?? headers['Retry-After'];
    const xReset = headers['x-ratelimit-reset'] ?? headers['X-RateLimit-Reset'];
    const xRemaining = headers['x-ratelimit-remaining'] ?? headers['X-RateLimit-Remaining'];

    if (retryAfterHeader) {
      const asNum = Number(retryAfterHeader);
      if (!Number.isNaN(asNum)) {
        info.retryAfterMs = Math.max(0, asNum * 1000);
      } else {
        const ts = Date.parse(String(retryAfterHeader));
        if (!Number.isNaN(ts)) info.retryAfterMs = Math.max(0, ts - Date.now());
      }
      info.rateLimited = true;
    }

    if (xRemaining !== undefined) {
      const remainingNum = Number(xRemaining);
      if (!Number.isNaN(remainingNum)) info.remaining = remainingNum;
    }

    if (xReset !== undefined) {
      const resetNum = Number(xReset);
      if (!Number.isNaN(resetNum)) {
        info.resetAt = resetNum < 10_000_000_000 ? resetNum * 1000 : resetNum;
      }
    }

    if (!info.rateLimited && /rate\s*limit|too many/i.test(message)) {
      info.rateLimited = true;
      info.reason = info.reason ?? 'regex:message';
    }

    return info;
  }
}
