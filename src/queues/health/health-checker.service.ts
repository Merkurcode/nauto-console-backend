import { Injectable, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { ILogger } from '@core/interfaces/logger.interface';
import { LOGGER_SERVICE } from '@shared/constants/tokens';

type QueueHealthSummary = {
  accepting: boolean;
  reason?: string[];
  lastCheck: number;
  pcts: { backlog: number; active: number; redis: number };
  latencyMs: number | null;
  pingFailures: number;
  limits: { maxBacklog: number; maxActive: number; maxRedisPct: number };
};

type MultiQueueHealthSummary = {
  [queueName: string]: QueueHealthSummary & { stale: boolean };
};

@Injectable()
export class HealthService implements OnModuleInit, OnModuleDestroy {
  private readonly logger: ILogger;

  private readonly CHECK_INTERVAL_MS: number;
  private readonly MAX_BACKLOG: number;
  private readonly MAX_ACTIVE: number;
  private readonly REDIS_MAX_FILL_PCT: number;
  private readonly REDIS_MAX_USED_MB: number;
  private readonly STALE_MS: number;

  private timer?: NodeJS.Timeout;
  private running = false;
  private checkInFlight = false;

  private queues: Map<string, Queue> = new Map();
  private queueStatuses: Map<string, QueueHealthSummary> = new Map();
  private pingFailures: Map<string, number> = new Map();

  constructor(
    @Inject(LOGGER_SERVICE) logger: ILogger,
    private readonly configService: ConfigService,
  ) {
    this.logger = logger.setContext(HealthService.name);

    // Initialize configuration values
    this.CHECK_INTERVAL_MS = this.configService.get<number>(
      'queue.performance.healthCheckIntervalMs',
      2000,
    );
    this.MAX_BACKLOG = this.configService.get<number>('queue.performance.maxBacklog', 5000);
    this.MAX_ACTIVE = this.configService.get<number>('queue.performance.maxActive', 200);
    this.REDIS_MAX_FILL_PCT = this.configService.get<number>(
      'queue.performance.redisMaxFillPct',
      0.85,
    );
    this.REDIS_MAX_USED_MB = this.configService.get<number>(
      'queue.performance.redisMaxUsedMb',
      2048,
    );
    this.STALE_MS = this.CHECK_INTERVAL_MS * 6;
  }

  async onModuleInit() {
    this.logger.debug('HealthService initialized - waiting for queue registration');
  }

  private startMonitoring() {
    if (this.running) {
      return;
    }

    if (this.queues.size > 0) {
      this.running = true;
      this.scheduleNext(0);
      this.logger.log(
        `Health monitoring started for ${this.queues.size} queue(s) (interval=${this.CHECK_INTERVAL_MS}ms)`,
      );
    }
  }

  onModuleDestroy() {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
  }

  registerQueue(name: string, queue: Queue) {
    this.queues.set(name, queue);
    this.pingFailures.set(name, 0);
    this.queueStatuses.set(name, {
      accepting: false,
      reason: [],
      lastCheck: -1,
      pcts: { backlog: 0, active: 0, redis: 0 },
      latencyMs: null,
      pingFailures: 0,
      limits: {
        maxBacklog: this.MAX_BACKLOG,
        maxActive: this.MAX_ACTIVE,
        maxRedisPct: this.REDIS_MAX_FILL_PCT,
      },
    });

    this.logger.log(`Registered queue: ${name}`);
    this.startMonitoring();
  }

  isStale(queueName?: string): boolean {
    if (queueName) {
      const status = this.queueStatuses.get(queueName);
      if (!status) return true;

      return status.lastCheck !== -1 && Date.now() - status.lastCheck > this.STALE_MS;
    }

    if (this.queueStatuses.size === 0) return true;

    for (const status of Array.from(this.queueStatuses.values())) {
      if (status.lastCheck !== -1 && Date.now() - status.lastCheck > this.STALE_MS) {
        return true;
      }
    }

    return false;
  }

  isAccepting(queueName?: string): boolean {
    if (queueName) {
      const status = this.queueStatuses.get(queueName);
      if (!status) return false;

      return !this.isStale(queueName) && status.accepting;
    }

    if (this.queueStatuses.size === 0) return false;
    if (this.isStale()) return false;

    for (const status of Array.from(this.queueStatuses.values())) {
      if (!status.accepting) return false;
    }

    return true;
  }

  getSummary(
    queueName?: string,
  ): (QueueHealthSummary & { stale: boolean }) | MultiQueueHealthSummary | null {
    if (queueName) {
      const status = this.queueStatuses.get(queueName);
      if (!status) {
        return {
          accepting: false,
          reason: ['queue_not_found'],
          lastCheck: -1,
          pcts: { backlog: 0, active: 0, redis: 0 },
          latencyMs: null,
          pingFailures: 0,
          limits: {
            maxBacklog: this.MAX_BACKLOG,
            maxActive: this.MAX_ACTIVE,
            maxRedisPct: this.REDIS_MAX_FILL_PCT,
          },
          stale: true,
        };
      }
      const stale = this.isStale(queueName);

      return { ...status, stale };
    }

    if (this.queueStatuses.size === 0) {
      return null;
    }

    const allSummaries: MultiQueueHealthSummary = {};
    for (const [name, status] of Array.from(this.queueStatuses.entries())) {
      const stale = this.isStale(name);
      allSummaries[name] = { ...status, stale };
    }

    return allSummaries;
  }

  getQueueNames(): string[] {
    return Array.from(this.queues.keys());
  }

  private scheduleNext(delayMs: number) {
    const h = setTimeout(async () => {
      if (!this.running) return;

      if (this.checkInFlight) {
        this.logger.debug('health: previous check running; delaying next tick');
        this.scheduleNext(this.CHECK_INTERVAL_MS);

        return;
      }

      this.checkInFlight = true;
      try {
        await this.checkAllQueues();
      } catch (e) {
        for (const queueName of Array.from(this.queues.keys())) {
          const currentStatus = this.queueStatuses.get(queueName);
          if (currentStatus) {
            this.queueStatuses.set(queueName, {
              ...currentStatus,
              accepting: false,
              reason: ['health_check_error'],
              lastCheck: Date.now(),
            });
          }
        }
        this.logger.warn(`health check failed: ${(e as Error).message}`);
      } finally {
        this.checkInFlight = false;
      }

      if (this.running) {
        const base = this.CHECK_INTERVAL_MS;
        const jitter = Math.floor(base * 0.1);
        const next = Math.max(200, base + (Math.random() * 2 - 1) * jitter);
        this.scheduleNext(next);
      }
    }, delayMs) as NodeJS.Timeout;
    (h as unknown as { unref?: () => void }).unref?.();
    this.timer = h;
  }

  private async checkAllQueues() {
    const checkPromises: Promise<void>[] = [];

    for (const [queueName, queue] of Array.from(this.queues.entries())) {
      checkPromises.push(this.checkQueue(queueName, queue));
    }

    await Promise.allSettled(checkPromises);
  }

  private async checkQueue(queueName: string, queue: Queue) {
    try {
      const counts = await queue.getJobCounts('waiting', 'delayed', 'active');
      const waiting = counts.waiting ?? (counts as any).wait ?? 0;
      const delayed = counts.delayed ?? 0;
      const active = counts.active ?? 0;

      const backlog = waiting + delayed;
      const backlogPct = this.safePct(backlog, this.MAX_BACKLOG);
      const activePct = this.safePct(active, this.MAX_ACTIVE);

      const redis = (await queue.client) as any;
      const latency = await this.pingWithTimeout(redis, 800);

      const currentFailures = this.pingFailures.get(queueName) || 0;
      if (!Number.isFinite(latency)) {
        this.pingFailures.set(queueName, currentFailures + 1);
      } else {
        this.pingFailures.set(queueName, 0);
      }

      const redisFillPct = await this.redisFill(redis, 300);

      let accepting = true;
      const reasons: string[] = [];

      if ((this.pingFailures.get(queueName) || 0) >= 2) {
        reasons.push('redis_ping_failed_twice');
      }
      if (backlogPct > 1) {
        reasons.push(`over_backlog(${backlog}>${this.MAX_BACKLOG})`);
      }
      if (activePct > 1) {
        reasons.push(`over_active(${active}>${this.MAX_ACTIVE})`);
      }
      if (redisFillPct > this.REDIS_MAX_FILL_PCT) {
        reasons.push(
          `redis_full(${(redisFillPct * 100).toFixed(0)}%>${(this.REDIS_MAX_FILL_PCT * 100).toFixed(0)}%)`,
        );
      }

      if (reasons.length > 0) {
        accepting = false;
      }

      this.queueStatuses.set(queueName, {
        accepting,
        reason: reasons,
        lastCheck: Date.now(),
        pcts: {
          backlog: Math.min(backlogPct, 10),
          active: Math.min(activePct, 10),
          redis: Math.min(redisFillPct, 10),
        },
        latencyMs: Number.isFinite(latency) ? latency : null,
        pingFailures: this.pingFailures.get(queueName) || 0,
        limits: {
          maxBacklog: this.MAX_BACKLOG,
          maxActive: this.MAX_ACTIVE,
          maxRedisPct: this.REDIS_MAX_FILL_PCT,
        },
      });

      if (!accepting) {
        this.logger.warn(`health down for queue '${queueName}': ${reasons.join(',')}`);
      }
    } catch (error) {
      this.logger.warn(
        `Failed to check queue '${queueName}': ${error instanceof Error ? error.message : String(error)}`,
      );
      this.queueStatuses.set(queueName, {
        accepting: false,
        reason: ['check_failed'],
        lastCheck: Date.now(),
        pcts: { backlog: 0, active: 0, redis: 0 },
        latencyMs: null,
        pingFailures: this.pingFailures.get(queueName) || 0,
        limits: {
          maxBacklog: this.MAX_BACKLOG,
          maxActive: this.MAX_ACTIVE,
          maxRedisPct: this.REDIS_MAX_FILL_PCT,
        },
      });
    }
  }

  private safePct(n: number, max: number) {
    return max > 0 ? n / max : 0;
  }

  private async pingWithTimeout(redis: any, timeoutMs: number): Promise<number> {
    const t0 = performance.now();
    try {
      await this.withTimeout(redis.ping(), timeoutMs, 'redis_ping');

      return performance.now() - t0;
    } catch {
      return Number.NaN;
    }
  }

  private async redisFill(redis: any, timeoutMs: number): Promise<number> {
    try {
      const info: string = await this.withTimeout(
        redis.call('INFO', 'MEMORY') as Promise<string>,
        timeoutMs,
        'redis_info',
      );

      const used = /used_memory:(\d+)/.exec(info)?.[1];
      const max = /maxmemory:(\d+)/.exec(info)?.[1];

      if (!used) {
        this.logger.warn('Redis INFO MEMORY did not return used_memory field');

        return 0;
      }

      const usedBytes = parseInt(used, 10);
      const maxBytes = max ? parseInt(max, 10) : 0;

      if (maxBytes > 0) {
        const ratio = usedBytes / maxBytes;

        return ratio;
      }

      const usedMB = usedBytes / (1024 * 1024);
      const ratio = usedMB / this.REDIS_MAX_USED_MB;

      return ratio;
    } catch (error) {
      this.logger.warn(
        `Failed to get Redis memory info: ${error instanceof Error ? error.message : String(error)}`,
      );

      return 0;
    }
  }

  private withTimeout<T>(p: Promise<T>, ms: number, label = 'op'): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const t = setTimeout(
        () => reject(new Error(`${label}_timeout_${ms}ms`)),
        ms,
      ) as NodeJS.Timeout;
      (t as any).unref?.();
      p.then(
        v => {
          clearTimeout(t);
          resolve(v);
        },
        e => {
          clearTimeout(t);
          reject(e);
        },
      );
    });
  }
}
