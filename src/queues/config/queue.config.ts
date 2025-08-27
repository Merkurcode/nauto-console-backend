import { ConfigService } from '@nestjs/config';

function validateHost(host: string): string {
  const trimmed = (host ?? '').toString().trim();
  const valid =
    /^(localhost|(\d{1,3}\.){3}\d{1,3}|[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*)$/;
  if (!valid.test(trimmed) || trimmed.length > 255) {
    throw new Error(`Invalid Redis host: ${host}`);
  }

  return trimmed;
}

function validatePort(port: string | number): number {
  const n = typeof port === 'string' ? parseInt(port, 10) : port;
  if (isNaN(n) || n < 0 || n > 65535) {
    throw new Error(`Invalid port/db: ${port}`);
  }

  return n;
}

function validatePrefix(prefix: string): string {
  const trimmed = (prefix ?? '').toString().trim();
  if (!/^[a-zA-Z0-9_:-]+$/.test(trimmed) || trimmed.length > 50) {
    throw new Error(`Invalid BullMQ prefix: ${prefix}`);
  }

  return trimmed;
}

export const getQueueConfig = (
  configService: ConfigService,
  processType: 'api' | 'worker' | 'both' = 'both',
) => {
  const host = validateHost(configService.get<string>('queue.redis.host')!);
  const port = validatePort(configService.get<number>('queue.redis.port')!);
  const db = Number(configService.get<number>('queue.redis.db') ?? 0); // Render: DB 0

  const tlsEnabled = configService.get<boolean>('queue.redis.tls.enabled');
  const isProd = process.env.NODE_ENV === 'production';

  const tls = tlsEnabled
    ? {
        // En prod valida el cert; en dev puedes desactivarlo si usas self-signed.
        rejectUnauthorized: isProd
          ? (configService.get<boolean>('queue.redis.tls.rejectUnauthorized') ?? true)
          : false,
        servername: configService.get<string>('queue.redis.tls.servername') || host,
        // Evita desactivar la verificación en prod:
        checkServerIdentity: isProd ? undefined : () => undefined,
      }
    : undefined;

  const prefix = validatePrefix(configService.get<string>('queue.bullmq.prefix')!);

  const isWorker = processType !== 'api';

  return {
    prefix,
    connection: {
      host,
      port,
      db, // Render suele permitir solo DB 0
      username: configService.get<string>('queue.redis.username'),
      password: configService.get<string>('queue.redis.password'),
      tls,

      // TCP sane defaults para cloud
      family: 4,
      keepAlive: 60_000,
      noDelay: true,

      // Arranque: workers deberían fallar rápido si no hay Redis
      lazyConnect: !isWorker, // api:true, worker:false
      enableReadyCheck: true, // si el proveedor bloquea INFO -> poner false
      enableOfflineQueue: !isWorker, // api:true, worker:false (no buffer en RAM del worker)

      connectionName: `bullmq-${processType}-${process.pid}`,

      // Tiempos y reintentos
      connectTimeout: 60_000,
      maxLoadingTimeout: 10_000,
      // IMPORTANTE para BullMQ en managed Redis:
      maxRetriesPerRequest: null, // evita MaxRetriesPerRequestError en micro-cortes
      retryStrategy: (times: number) => Math.min(1_000 + times * 2_000, 10_000),

      // ioredis v5+ admite timeouts por comando:
      commandTimeout: 30_000, // opcional: aborta comandos colgados
    },
  };
};

// Helper function to get default configurations from ConfigService
export const getQueueModuleConfig = (configService: ConfigService) => {
  return {
    processor: {
      concurrency: configService.get<number>('queue.events.concurrency'),
      maxStalledCount: 3,
      stalledInterval: 30000,
    },
    jobs: {
      attempts: configService.get<number>('queue.events.attempts'),
      backoff: {
        type: 'fixed' as const,
        delay: configService.get<number>('queue.events.backoffDelay'),
      },
      removeOnComplete: { age: 60, count: 1000 },
      removeOnFail: { age: 300, count: 500 },
    },
    queue: {
      name: configService.get<string>('queue.events.defaultQueue'),
      retryWindowMs: configService.get<number>('queue.events.retryWindowHours') * 60 * 60 * 1000,
    },
  };
};

// PERF constants using ConfigService values
export const getPerformanceConfig = (configService: ConfigService) => ({
  HEALTH_CHECK_INTERVAL: configService.get<number>('queue.performance.healthCheckIntervalMs'),
  MAX_BACKLOG: configService.get<number>('queue.performance.maxBacklog'),
  MAX_ACTIVE: configService.get<number>('queue.performance.maxActive'),
  REDIS_MAX_FILL_PCT: configService.get<number>('queue.performance.redisMaxFillPct'),
  REDIS_MAX_USED_MB: configService.get<number>('queue.performance.redisMaxUsedMb'),
  EVENT_MAX_BYTES: configService.get<number>('queue.performance.eventMaxBytes'),
});
