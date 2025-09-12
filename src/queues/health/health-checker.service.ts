// health.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, RedisClient } from 'bullmq';
import { ILogger } from '@core/interfaces/logger.interface';
import { LOGGER_SERVICE } from '@shared/constants/tokens';

type QueueHealthSummary = {
  accepting: boolean;
  reason?: string[];
  lastCheck: number; // epoch ms
  pcts: { backlog: number; active: number; redis: number }; // [0..∞)
  latencyMs: number | null; // redis PING
  pingFailures: number;
  limits: {
    maxBacklog: number;
    maxActive: number;
    maxRedisPct: number; // 0..1 si hay maxmemory
    maxRedisMb?: number; // umbral MB cuando maxmemory=0 (fallback)
    // Capacidad real usada para evaluar salud
    redisCapacityMB?: number;
    redisCapacityBytes?: number;
    redisCapacitySource?: 'maxmemory' | 'fallback_mb' | 'cluster_worst';
  };
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
  private readonly CRITICAL_QUEUES: Set<string>;

  private timer?: NodeJS.Timeout;
  private running = false;
  private checkInFlight = false;

  private queues: Map<string, Queue> = new Map();
  private queueStatuses: Map<string, QueueHealthSummary> = new Map();
  private pingFailures: Map<string, number> = new Map();

  // rate limit de warnings por cola+razón (evita ruido)
  private lastWarnAt: Map<string, number> = new Map();
  private readonly WARN_MIN_INTERVAL_MS: number;

  constructor(
    @Inject(LOGGER_SERVICE) logger: ILogger,
    private readonly config: ConfigService,
  ) {
    this.logger = logger.setContext(HealthService.name);

    this.CHECK_INTERVAL_MS = this.config.get<number>(
      'queue.performance.healthCheckIntervalMs',
      2000,
    );
    this.MAX_BACKLOG = this.config.get<number>('queue.performance.maxBacklog', 5000);
    this.MAX_ACTIVE = this.config.get<number>('queue.performance.maxActive', 200);
    this.REDIS_MAX_FILL_PCT = this.config.get<number>('queue.performance.redisMaxFillPct', 0.85);
    this.REDIS_MAX_USED_MB = this.config.get<number>('queue.performance.redisMaxUsedMb', 2048);
    this.WARN_MIN_INTERVAL_MS = this.config.get<number>(
      'queue.performance.warnMinIntervalMs',
      30_000,
    );
    // “stale” si pasan ~6 intervalos sin actualizar
    this.STALE_MS = this.config.get<number>(
      'queue.performance.staleMs',
      this.CHECK_INTERVAL_MS * 6,
    );

    // define colas críticas desde config (coma-separado); si vacío, todas se consideran críticas
    const criticalList = this.config.get<string>('queue.performance.criticalQueues', '') || '';
    const parsed = criticalList
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    this.CRITICAL_QUEUES = new Set(parsed);
  }

  async onModuleInit() {
    this.logger.debug('HealthService initialized (waiting for queue registration)');
  }

  onModuleDestroy() {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
  }

  registerQueue(name: string, queue: Queue) {
    this.queues.set(name, queue);
    this.pingFailures.set(name, 0);
    // Estado “optimista” al arranque para evitar falsos negativos pre-primer check
    this.queueStatuses.set(name, {
      accepting: true,
      reason: [],
      lastCheck: Date.now(),
      pcts: { backlog: 0, active: 0, redis: 0 },
      latencyMs: null,
      pingFailures: 0,
      limits: {
        maxBacklog: this.MAX_BACKLOG,
        maxActive: this.MAX_ACTIVE,
        maxRedisPct: this.REDIS_MAX_FILL_PCT,
        maxRedisMb: this.REDIS_MAX_USED_MB,
        redisCapacityMB: undefined,
        redisCapacityBytes: undefined,
        redisCapacitySource: undefined,
      },
    });

    this.logger.log(`Registered queue: ${name}`);
    this.startMonitoring();
  }

  unregisterQueue(name: string) {
    this.queues.delete(name);
    this.pingFailures.delete(name);
    this.queueStatuses.delete(name);
  }

  getQueueNames(): string[] {
    return Array.from(this.queues.keys());
  }

  isStale(queueName?: string): boolean {
    if (queueName) {
      const s = this.queueStatuses.get(queueName);

      return !s || (s.lastCheck !== -1 && Date.now() - s.lastCheck > this.STALE_MS);
    }
    if (this.queueStatuses.size === 0) return true;
    // Global: sólo “stale” si TODAS lo están (evita bloquear por una sola)
    for (const s of this.queueStatuses.values()) {
      const stale = s.lastCheck !== -1 && Date.now() - s.lastCheck > this.STALE_MS;
      if (!stale) return false;
    }

    return true;
  }

  isAccepting(queueName?: string): boolean {
    if (queueName) {
      const s = this.queueStatuses.get(queueName);

      return !!s && !this.isStale(queueName) && s.accepting;
    }
    if (this.queueStatuses.size === 0) return false;
    if (this.isStale()) return false;

    const criticalSet =
      this.CRITICAL_QUEUES.size > 0 ? this.CRITICAL_QUEUES : new Set(this.getQueueNames());

    for (const [name, s] of this.queueStatuses.entries()) {
      if (!criticalSet.has(name)) continue; // colas no críticas no bloquean aceptación global
      if (!s.accepting) return false;
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
            maxRedisMb: this.REDIS_MAX_USED_MB,
            redisCapacityMB: undefined,
            redisCapacityBytes: undefined,
            redisCapacitySource: undefined,
          },
          stale: true,
        };
      }
      const stale = this.isStale(queueName);

      return { ...status, stale };
    }

    if (this.queueStatuses.size === 0) return null;
    const out: MultiQueueHealthSummary = {};
    for (const [name, status] of this.queueStatuses.entries()) {
      out[name] = { ...status, stale: this.isStale(name) };
    }

    return out;
  }

  // --------------------------------------------------------------------------
  // Scheduler
  // --------------------------------------------------------------------------

  private startMonitoring() {
    if (this.running) return;
    if (this.queues.size > 0) {
      this.running = true;
      // primer check lo más pronto posible
      this.scheduleNext(0);
      this.logger.log(
        `Health monitoring started for ${this.queues.size} queue(s) (interval=${this.CHECK_INTERVAL_MS}ms)`,
      );
    }
  }

  private scheduleNext(delayMs: number) {
    const h = setTimeout(async () => {
      if (!this.running) return;

      // evita reentrancia; si un tick se alarga, no encadenes más
      if (this.checkInFlight) {
        this.logger.debug('health: previous check running; delaying next tick');
        this.scheduleNext(this.CHECK_INTERVAL_MS);

        return;
      }

      this.checkInFlight = true;
      try {
        await this.checkAllQueues();
      } catch (e) {
        // marca todas “down” conservadoramente si ocurrió un fallo fuera de check por cola
        const now = Date.now();
        for (const [queueName, s] of this.queueStatuses.entries()) {
          this.queueStatuses.set(queueName, {
            ...s,
            accepting: false,
            reason: ['health_check_error'],
            lastCheck: now,
          });
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
    const tasks: Promise<void>[] = [];
    for (const [name, queue] of this.queues.entries()) {
      tasks.push(this.checkQueue(name, queue));
    }
    await Promise.allSettled(tasks);
  }

  // --------------------------------------------------------------------------
  // Core check
  // --------------------------------------------------------------------------

  private async checkQueue(queueName: string, queue: Queue) {
    const now = Date.now();
    try {
      const counts = await this.withTimeout(
        queue.getJobCounts('waiting', 'delayed', 'active'),
        1000,
        'job_counts',
      );
      const waiting = counts.waiting ?? counts.wait ?? 0;
      const delayed = counts.delayed ?? 0;
      const active = counts.active ?? 0;

      const backlog = waiting + delayed;
      const backlogPct = this.safePct(backlog, this.MAX_BACKLOG);
      const activePct = this.safePct(active, this.MAX_ACTIVE);

      const redisClient = await this.withTimeout(
        queue.client as Promise<RedisClient>,
        1000,
        'queue_client',
      );

      const latency = await this.pingWithTimeout(redisClient, 800);

      // tracking de ping failures
      const prevFailures = this.pingFailures.get(queueName) || 0;
      if (!Number.isFinite(latency)) {
        this.pingFailures.set(queueName, prevFailures + 1);
      } else {
        this.pingFailures.set(queueName, 0);
      }

      // soporte single/cluster y ioredis/node-redis, con fallback si no hay maxmemory
      const redisFillPct = await this.withTimeout(
        this.redisWorstFillPct(redisClient, 900),
        1000,
        'redis_info',
      );

      // capacidad real (MB/bytes) que se está usando para evaluar salud
      const { capacityBytes, source: capacitySource } = await this.withTimeout(
        this.resolveRedisCapacityWorst(redisClient),
        900,
        'redis_capacity',
      );
      const capacityMB = Math.round((capacityBytes / (1024 * 1024)) * 10) / 10; // 1 decimal

      let accepting = true;
      const reasons: string[] = [];

      const pingFails = this.pingFailures.get(queueName) || 0;
      if (pingFails >= 2) {
        reasons.push('redis_ping_failed_twice');
      }
      if (backlogPct > 1) {
        reasons.push(`over_backlog(${backlog}>${this.MAX_BACKLOG})`);
      }
      if (activePct > 1) {
        reasons.push(`over_active(${active}>${this.MAX_ACTIVE})`);
      }
      if (Number.isFinite(redisFillPct) && redisFillPct > this.REDIS_MAX_FILL_PCT) {
        reasons.push(
          `redis_full(${(redisFillPct * 100).toFixed(0)}%>${(this.REDIS_MAX_FILL_PCT * 100).toFixed(
            0,
          )}%)`,
        );
      }
      if (!Number.isFinite(redisFillPct)) {
        // si falló INFO, sé conservador y no aceptes
        reasons.push('redis_info_unavailable');
      }

      if (reasons.length > 0) accepting = false;

      this.queueStatuses.set(queueName, {
        accepting,
        reason: reasons,
        lastCheck: now,
        pcts: {
          backlog: backlogPct,
          active: activePct,
          redis: Number.isFinite(redisFillPct) ? redisFillPct : Number.POSITIVE_INFINITY,
        },
        latencyMs: Number.isFinite(latency) ? latency : null,
        pingFailures: pingFails,
        limits: {
          maxBacklog: this.MAX_BACKLOG,
          maxActive: this.MAX_ACTIVE,
          maxRedisPct: this.REDIS_MAX_FILL_PCT,
          maxRedisMb: this.REDIS_MAX_USED_MB,
          redisCapacityMB: capacityMB,
          redisCapacityBytes: capacityBytes,
          redisCapacitySource:
            typeof (redisClient as any)?.nodes === 'function'
              ? 'cluster_worst'
              : (capacitySource as 'maxmemory' | 'fallback_mb'),
        },
      });

      if (!accepting) {
        this.warnThrottled(
          queueName,
          reasons.join(','),
          `health down for queue '${queueName}': ${reasons.join(',')}`,
        );

        // === LOG DETALLADO DE PROBLEMAS ===
        await this.logHealthProblems(queueName, {
          reasons,
          waiting,
          delayed,
          active,
          backlog,
          backlogPct,
          activePct,
          redisFillPct: Number.isFinite(redisFillPct) ? redisFillPct : null,
          pingFails,
          latencyMs: Number.isFinite(latency) ? latency : null,
          limits: {
            maxBacklog: this.MAX_BACKLOG,
            maxActive: this.MAX_ACTIVE,
            maxRedisPct: this.REDIS_MAX_FILL_PCT,
            maxRedisMb: this.REDIS_MAX_USED_MB,
            redisCapacityMB: capacityMB,
            redisCapacityBytes: capacityBytes,
            redisCapacitySource:
              typeof (redisClient as any)?.nodes === 'function'
                ? 'cluster_worst'
                : (capacitySource as 'maxmemory' | 'fallback_mb'),
          },
          redisClient,
        });
      }
    } catch (error) {
      // incrementa pingFailures también en errores generales del check
      const pf = (this.pingFailures.get(queueName) || 0) + 1;
      this.pingFailures.set(queueName, pf);

      this.queueStatuses.set(queueName, {
        accepting: false,
        reason: ['check_failed'],
        lastCheck: now,
        pcts: { backlog: 0, active: 0, redis: Number.POSITIVE_INFINITY },
        latencyMs: null,
        pingFailures: pf,
        limits: {
          maxBacklog: this.MAX_BACKLOG,
          maxActive: this.MAX_ACTIVE,
          maxRedisPct: this.REDIS_MAX_FILL_PCT,
          maxRedisMb: this.REDIS_MAX_USED_MB,
          redisCapacityMB: undefined,
          redisCapacityBytes: undefined,
          redisCapacitySource: undefined,
        },
      });

      this.warnThrottled(
        queueName,
        'check_failed',
        `Failed to check queue '${queueName}': ${
          error instanceof Error ? error.message : String(error)
        }`,
      );

      // Log estructurado en caso de excepción del check
      this.logger.error(
        `[health:check_failed] ${queueName} ${JSON.stringify({
          error: error instanceof Error ? error.message : String(error),
          pingFailures: pf,
        })}`,
      );
    }
  }

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  private safePct(n: number, max: number) {
    if (!Number.isFinite(n) || !Number.isFinite(max) || max <= 0) return 0;

    return n / max;
  }

  private async pingWithTimeout(redis: any, timeoutMs: number): Promise<number> {
    const t0 = Date.now();
    try {
      await this.withTimeout(this.redisPing(redis), timeoutMs, 'redis_ping');

      return Date.now() - t0;
    } catch {
      return Number.NaN;
    }
  }

  private async redisPing(redis: any): Promise<void> {
    if (typeof redis.ping === 'function') {
      await redis.ping();

      return;
    }
    if (typeof redis.call === 'function') {
      await redis.call('PING');

      return;
    }
    if (typeof redis.sendCommand === 'function') {
      await redis.sendCommand(['PING']);

      return;
    }
    // si no tiene PING, intenta un INFO corto
    await this.infoMemoryString(redis);
  }

  private async redisWorstFillPct(client: any, timeoutMs: number): Promise<number> {
    // ioredis Cluster expone .nodes(role)
    if (typeof client?.nodes === 'function') {
      const nodes = client.nodes('all');
      let worst = 0;
      for (const node of nodes) {
        const pct = await this.withTimeout(
          this.redisFillPctFromInfo(node),
          timeoutMs,
          'redis_info_node',
        );
        if (!Number.isFinite(pct)) return Number.NaN; // si algún nodo falla, invalida
        if (pct > worst) worst = pct;
      }

      return worst;
    }

    // single node
    return await this.redisFillPctFromInfo(client);
  }

  private async infoMemoryString(redis: any): Promise<string> {
    if (typeof redis.info === 'function') {
      // ioredis & node-redis >=4
      return await redis.info('memory');
    }
    if (typeof redis.call === 'function') {
      return (await redis.call('INFO', 'MEMORY')) as string;
    }
    if (typeof redis.sendCommand === 'function') {
      return (await redis.sendCommand(['INFO', 'MEMORY'])) as string;
    }
    throw new Error('Unsupported Redis client: no info/call/sendCommand');
  }

  private parseInfoMemory(s: string): {
    usedBytes: number;
    maxBytes: number; // 0 = sin límite
    totalSystemBytes?: number;
  } {
    const used = /used_memory:(\d+)/.exec(s)?.[1];
    const max = /maxmemory:(\d+)/.exec(s)?.[1];
    const sys = /total_system_memory:(\d+)/.exec(s)?.[1];

    return {
      usedBytes: used ? parseInt(used, 10) : 0,
      maxBytes: max ? parseInt(max, 10) : 0,
      totalSystemBytes: sys ? parseInt(sys, 10) : undefined,
    };
  }

  /**
   * Devuelve fill en [0..∞):
   * - Si maxmemory>0: used/max (exacto)
   * - Si maxmemory=0: fallback a umbral MB (REDIS_MAX_USED_MB). (Conservador y estable)
   */
  private async redisFillPctFromInfo(redis: any): Promise<number> {
    try {
      const info = await this.infoMemoryString(redis);
      const sample = this.parseInfoMemory(info);

      if (sample.maxBytes > 0) {
        return sample.usedBytes / Math.max(1, sample.maxBytes);
      }
      // Sin maxmemory configurado: fallback estable a MB
      const usedMB = sample.usedBytes / (1024 * 1024);

      return usedMB / Math.max(1, this.REDIS_MAX_USED_MB);
    } catch (e) {
      // Conservador: invalida la lectura para que la decisión no “apruebe” por error
      this.logger.warn(
        `Failed to read Redis INFO MEMORY: ${e instanceof Error ? e.message : String(e)}`,
      );

      return Number.NaN;
    }
  }

  // === Capacidad real (single/cluster) ===
  private async resolveRedisCapacitySingle(redis: any): Promise<{
    capacityBytes: number;
    source: 'maxmemory' | 'fallback_mb';
  }> {
    const info = await this.infoMemoryString(redis);
    const parsed = this.parseInfoMemory(info);
    if (parsed.maxBytes > 0) {
      return { capacityBytes: parsed.maxBytes, source: 'maxmemory' };
    }

    // fallback por MB configurado
    return {
      capacityBytes: Math.max(1, this.REDIS_MAX_USED_MB) * 1024 * 1024,
      source: 'fallback_mb',
    };
  }

  private async resolveRedisCapacityWorst(client: any): Promise<{
    capacityBytes: number;
    source: 'maxmemory' | 'fallback_mb' | 'cluster_worst';
  }> {
    if (typeof client?.nodes === 'function') {
      // cluster: elegimos el “peor” nodo como referencia (consistente con redisWorstFillPct)
      const nodes = client.nodes('all');
      let worstCap = 0;
      let worstSrc: 'maxmemory' | 'fallback_mb' = 'fallback_mb';
      for (const node of nodes) {
        try {
          const { capacityBytes, source } = await this.resolveRedisCapacitySingle(node);
          // “peor” = menor capacidad efectiva
          if (worstCap === 0 || capacityBytes < worstCap) {
            worstCap = capacityBytes;
            worstSrc = source;
          }
        } catch {
          // si un nodo falla, continúa; si todos fallan, caeremos a fallback global abajo
        }
      }
      if (worstCap > 0) {
        return { capacityBytes: worstCap, source: 'cluster_worst' };
      }

      // si no se pudo leer ninguno, cae a fallback MB
      return {
        capacityBytes: Math.max(1, this.REDIS_MAX_USED_MB) * 1024 * 1024,
        source: 'cluster_worst',
      };
    }

    return await this.resolveRedisCapacitySingle(client);
  }

  private warnThrottled(queueName: string, reasonKey: string, message: string) {
    const key = `${queueName}|${reasonKey}`;
    const now = Date.now();
    const last = this.lastWarnAt.get(key) || 0;
    if (now - last >= this.WARN_MIN_INTERVAL_MS) {
      this.lastWarnAt.set(key, now);
      this.logger.warn(message);
    } else {
      this.logger.debug(`(suppressed warn) ${message}`);
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

  // --------------------------------------------------------------------------
  // LOG DETALLADO DE PROBLEMAS
  // --------------------------------------------------------------------------
  private async logHealthProblems(
    queueName: string,
    details: {
      reasons: string[];
      waiting: number;
      delayed: number;
      active: number;
      backlog: number;
      backlogPct: number;
      activePct: number;
      redisFillPct: number | null;
      pingFails: number;
      latencyMs: number | null;
      limits: {
        maxBacklog: number;
        maxActive: number;
        maxRedisPct: number;
        maxRedisMb: number;
        redisCapacityMB: number;
        redisCapacityBytes: number;
        redisCapacitySource: 'maxmemory' | 'fallback_mb' | 'cluster_worst';
      };
      redisClient: any;
    },
  ): Promise<void> {
    // intenta tomar un snapshot de memoria para enriquecer el log (sin romper si falla)
    const memSnapshot: { usedMB?: number; maxMB?: number; maxBytes?: number } = {};
    try {
      const info = await this.infoMemoryString(details.redisClient);
      const parsed = this.parseInfoMemory(info);
      memSnapshot.usedMB = parsed.usedBytes > 0 ? parsed.usedBytes / (1024 * 1024) : undefined;
      memSnapshot.maxBytes = parsed.maxBytes;
      memSnapshot.maxMB = parsed.maxBytes > 0 ? parsed.maxBytes / (1024 * 1024) : undefined;
    } catch {
      // noop
    }

    // umbral (bytes) donde se considera “full” según REDIS_MAX_FILL_PCT y capacidad efectiva
    const thresholdBytes = Math.round(details.limits.redisCapacityBytes * this.REDIS_MAX_FILL_PCT);

    const payload = {
      queue: queueName,
      reasons: details.reasons,
      metrics: {
        waiting: details.waiting,
        delayed: details.delayed,
        active: details.active,
        backlog: details.backlog,
        backlogPct: Number.isFinite(details.backlogPct)
          ? Number(details.backlogPct.toFixed(3))
          : null,
        activePct: Number.isFinite(details.activePct) ? Number(details.activePct.toFixed(3)) : null,
        redisFillPct:
          details.redisFillPct === null ? null : Number(details.redisFillPct.toFixed(3)),
        latencyMs: details.latencyMs,
        pingFailures: details.pingFails,
      },
      limits: {
        maxBacklog: details.limits.maxBacklog,
        maxActive: details.limits.maxActive,
        maxRedisPct: details.limits.maxRedisPct, // lo que compara el servicio
        maxRedisMb: details.limits.maxRedisMb, // fallback configurado
        redisCapacityMB: details.limits.redisCapacityMB, // capacidad efectiva (MB)
        redisCapacityBytes: details.limits.redisCapacityBytes, // capacidad efectiva (bytes)
        redisCapacitySource: details.limits.redisCapacitySource, // cómo se determinó
        redisFullThresholdBytes: thresholdBytes,
        redisFullThresholdMB: Math.round((thresholdBytes / (1024 * 1024)) * 10) / 10,
      },
      redisMemory: {
        usedMB: memSnapshot.usedMB ? Number(memSnapshot.usedMB.toFixed(1)) : null,
        maxMB: memSnapshot.maxMB ? Number(memSnapshot.maxMB.toFixed(1)) : null,
        maxBytes: memSnapshot.maxBytes ?? null,
      },
      at: new Date().toISOString(),
    };

    // Un solo log JSON “problem report” (ideal para parsers/alertas)
    this.logger.error(`[health:problem] ${JSON.stringify(payload)}`);
  }
}
