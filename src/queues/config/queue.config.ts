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

/**
 * Crea una conexión Redis dedicada para BullMQ con configuración robusta
 * IMPORTANTE: Esta función crea conexiones SEPARADAS del RedisModule para evitar conflictos
 */
function createBullMQRedisConnection(
  configService: ConfigService,
  processType: 'api' | 'worker' | 'both',
): Record<string, unknown> {
  const host = validateHost(configService.get<string>('queue.redis.host')!);
  const port = validatePort(configService.get<number>('queue.redis.port')!);
  const db = Number(configService.get<number>('queue.redis.db') ?? 0);
  const blockTimeout = configService.get<number>('queue.bullmq.blockTimeout', 30);

  const tlsEnabled = configService.get<boolean>('queue.redis.tls.enabled');
  const isProd = process.env.NODE_ENV === 'production';

  const tls = tlsEnabled
    ? {
        rejectUnauthorized: isProd
          ? (configService.get<boolean>('queue.redis.tls.rejectUnauthorized') ?? true)
          : false,
        servername: configService.get<string>('queue.redis.tls.servername') || host,
        checkServerIdentity: isProd ? undefined : () => undefined,
      }
    : undefined;

  const isWorker = processType !== 'api';
  const connectionName = `bullmq-${processType}-${process.pid}`;

  return {
    host,
    port,
    db,
    username: configService.get<string>('queue.redis.username'),
    password: configService.get<string>('queue.redis.password'),
    tls,

    // TCP sane defaults optimizado para estabilidad local
    family: 4,
    keepAlive: 5000, // 5s - más frecuente para estabilidad en desarrollo
    noDelay: true,

    // Arranque optimizado para workers vs API
    lazyConnect: false, // Siempre conectar inmediatamente para estabilidad
    enableReadyCheck: true,
    enableOfflineQueue: isWorker ? false : true, // Workers: no buffer, API: sí buffer

    connectionName,

    // Tiempos y reintentos optimizados
    connectTimeout: 10000, // Reducido de 60s a 10s
    maxLoadingTimeout: 5000, // Reducido de 10s a 5s

    // CRÍTICO para BullMQ en managed Redis:
    maxRetriesPerRequest: null,
    retryStrategy: (times: number) => {
      const delay = Math.min(times * 200, 2000); // Menos agresivo: 200ms, 400ms, ..., max 2s

      // SUPPRESS LOGS: Solo mostrar si falla repetidamente (>3 attempts) en desarrollo
      if (times > 3 && process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.log(`[${connectionName}] Redis reconnect attempt ${times}, delay: ${delay}ms`);
      }

      return delay;
    },

    // Reintenta ante estados transitorios + el error específico que estás viendo
    reconnectOnError: (err: Error) => {
      const msg = err?.message || '';
      const shouldReconnect =
        msg.includes('READONLY') ||
        msg.includes('MOVED') ||
        msg.includes('ASK') ||
        msg.includes('CLUSTERDOWN') ||
        msg.includes('Connection is closed') ||
        msg.includes("Stream isn't writeable") || // ← CRÍTICO para tu error
        msg.includes('enableOfflineQueue options is false');

      if (shouldReconnect) {
        // DIAGNOSIS: Siempre logear la causa de reconexión para debug
        console.warn(`[${connectionName}] 🔄 Redis reconnecting due to: "${msg}"`);

        return true;
      } else {
        // Solo logear errores inesperados (no reconexión)
        console.error(`[${connectionName}] ❌ Redis error (not reconnecting): "${msg}"`);
      }

      return false;
    },

    // Timeout para comandos - más agresivo para workers
    commandTimeout: isWorker ? blockTimeout * 1000 + 5000 : 15000,
  };
}

export const getQueueConfig = (
  configService: ConfigService,
  processType: 'api' | 'worker' | 'both' = 'both',
) => {
  const prefix = validatePrefix(configService.get<string>('queue.bullmq.prefix')!);
  const isWorker = processType !== 'api';

  // Usar conexión Redis dedicada para BullMQ (NO compartida con RedisModule)
  const connection = createBullMQRedisConnection(configService, processType);

  const baseConfig = {
    prefix,
    connection,
  };

  // Para workers: configuraciones específicas críticas para evitar tu error
  if (isWorker) {
    return {
      ...baseConfig,

      // CRÍTICO: evita bloqueos indefinidos en BZPOPMIN
      defaultJobOptions: {
        removeOnComplete: 100, // Keep only last 100 completed jobs
        removeOnFail: 50, // Keep only last 50 failed jobs
      },
    };
  }

  return baseConfig;
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

/**
 * Configuración específica para Workers BullMQ
 * INCLUYE blockTimeout para evitar "Stream isn't writeable"
 * NOTA: La conexión se debe configurar por separado en cada Worker
 */
export const getWorkerConfig = (configService: ConfigService) => {
  const blockTimeout = configService.get<number>('queue.bullmq.blockTimeout', 30);

  return {
    // CRÍTICO: evita bloqueos indefinidos en BZPOPMIN
    blockTimeout, // seconds - evita "Stream isn't writeable" en idle timeouts

    // Worker settings para conexiones inestables
    settings: {
      stalledInterval: 30000, // Check for stalled jobs every 30s
      maxStalledCount: 1, // Max times a job can be recovered
      retryProcessDelay: 5000, // Delay before retrying after process failure
    },
  };
};
