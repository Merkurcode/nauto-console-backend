import Redis, { RedisOptions } from 'ioredis';
import { ConfigService } from '@nestjs/config';

export interface IRedisConnectionFactory {
  createConnection(purpose: string, additionalConfig?: Partial<RedisOptions>): Redis;
  createFromUrl(url: string, purpose: string, additionalConfig?: Partial<RedisOptions>): Redis;
}

/**
 * Factory para crear conexiones Redis dedicadas y robustas
 * Evita problemas de shared connections entre BullMQ y otros servicios
 */
export class RedisConnectionFactory implements IRedisConnectionFactory {
  private readonly baseConfig: RedisOptions;
  private readonly connectionPool = new Map<string, Redis>();

  constructor(private readonly configService: ConfigService) {
    // Configuración base robusta para todas las conexiones
    this.baseConfig = {
      // Evita que ioredis "falle" promesas si se reconecta
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      lazyConnect: false,

      // ENHANCED: Mantén vivo el socket (evita cierre por idle en LBs y desarrollo)
      keepAlive: 5000, // Reduced to 5s for more frequent keep-alive
      connectTimeout: 15000, // Increased for slower connections
      commandTimeout: 20000, // Increased for better reliability

      // SOCKET-level keep-alive para estabilidad máxima
      family: 4, // Force IPv4 (more stable than IPv6 in many local setups)

      // Configuración adicional para estabilidad en desarrollo
      enableOfflineQueue: true, // Allow commands to queue during reconnection
      disconnectTimeout: 5000, // Wait 5s before declaring disconnection

      // Backoff de reconexión agresivo
      retryStrategy: this.createRetryStrategy.bind(this),

      // Reintenta ante estados transitorios de Redis Cluster/Sentinel
      reconnectOnError: this.createReconnectOnErrorHandler.bind(this),
    };
  }

  /**
   * Crea una conexión Redis dedicada con propósito específico
   */
  createConnection(purpose: string, additionalConfig?: Partial<RedisOptions>): Redis {
    // Para storage/concurrency usa URL específica, para otros propósitos usa configuración de queue
    const redisUrl =
      purpose === 'storage-concurrency'
        ? this.configService.get<string>('storage.concurrency.redisUrl', 'redis://127.0.0.1:6379')
        : this.buildRedisUrlFromConfig();

    return this.createFromUrl(redisUrl, purpose, additionalConfig);
  }

  /**
   * Construye URL Redis desde configuración de queue
   */
  private buildRedisUrlFromConfig(): string {
    const host = this.configService.get<string>('queue.redis.host', 'localhost');
    const port = this.configService.get<number>('queue.redis.port', 6379);
    const db = this.configService.get<number>('queue.redis.db', 0);
    const username = this.configService.get<string>('queue.redis.username');
    const password = this.configService.get<string>('queue.redis.password');

    let url = 'redis://';
    if (username && password) {
      url += `${username}:${password}@`;
    }
    url += `${host}:${port}/${db}`;

    return url;
  }

  /**
   * Crea una conexión Redis desde URL con pooling para reducir conexiones
   */
  createFromUrl(url: string, purpose: string, additionalConfig?: Partial<RedisOptions>): Redis {
    // CONNECTION POOLING: Reutiliza conexiones por propósito para reducir overhead
    const poolKey = `${purpose}-${process.pid}`;

    if (this.connectionPool.has(poolKey)) {
      const existingConnection = this.connectionPool.get(poolKey)!;
      // Verificar si la conexión está activa
      if (existingConnection.status === 'ready' || existingConnection.status === 'connecting') {
        return existingConnection;
      } else {
        // Limpiar conexión muerta del pool
        this.connectionPool.delete(poolKey);
      }
    }

    const connectionName = poolKey; // Sin timestamp para pooling efectivo

    const config: RedisOptions = {
      ...this.baseConfig,
      connectionName,
      ...additionalConfig,
    };

    const redis = new Redis(url, config);

    // Agregar al pool SOLO si es exitosa
    redis.on('ready', () => {
      this.connectionPool.set(poolKey, redis);
    });

    // Remover del pool si se desconecta
    redis.on('close', () => {
      this.connectionPool.delete(poolKey);
    });

    // Logging detallado para debugging
    this.setupConnectionLogging(redis, connectionName);

    return redis;
  }

  /**
   * Estrategia de retry robusta
   */
  private createRetryStrategy(purpose?: string) {
    return (times: number) => {
      // OPTIMIZED: Quick reconnection for BullMQ stability
      const delay = Math.min(times * 100, 1000); // 100ms -> 1s max (fast reconnect)
      const connectionId = purpose || 'unknown';

      // DEVELOPMENT: Suppress reconnect logging for cleaner console
      // Only log if reconnection is failing repeatedly (> 5 attempts)
      if (times > 5 && process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-console
        console.log(`[${connectionId}] Redis reconnect attempt ${times}, delay: ${delay}ms`);
      }

      return delay;
    };
  }

  /**
   * Handler para reconexión en errores específicos
   */
  private createReconnectOnErrorHandler(purpose?: string) {
    return (err: Error) => {
      const msg = err?.message || '';
      const shouldReconnect =
        msg.includes('READONLY') ||
        msg.includes('MOVED') ||
        msg.includes('ASK') ||
        msg.includes('CLUSTERDOWN') ||
        msg.includes('Connection is closed') ||
        msg.includes("Stream isn't writeable");

      if (shouldReconnect) {
        const connectionId = purpose || 'unknown';
        console.warn(`[${connectionId}] Redis reconnecting due to: ${msg}`);

        return true;
      }

      return false;
    };
  }

  /**
   * Configura logging detallado para debugging
   */
  private setupConnectionLogging(redis: Redis, connectionName: string): void {
    const isDev = process.env.NODE_ENV === 'development';
    const isImportantConnection =
      connectionName.includes('storage') || connectionName.includes('api');

    redis.on('connect', () => {
      // Only log important connections in development to reduce noise
      if (!isDev || isImportantConnection) {
        // eslint-disable-next-line no-console
        console.log(`[${connectionName}] Redis connected successfully`);
      }
    });

    redis.on('ready', () => {
      // Only log important connections in development
      if (!isDev || isImportantConnection) {
        // eslint-disable-next-line no-console
        console.log(`[${connectionName}] Redis ready for commands`);
      }
    });

    redis.on('error', err => {
      // Always log actual errors, filter known reconnect scenarios
      const msg = err.message;
      const isKnownReconnectError =
        msg.includes('READONLY') ||
        msg.includes('MOVED') ||
        msg.includes("Stream isn't writeable") ||
        msg.includes('Connection is closed') ||
        msg.includes('Socket closed unexpectedly');

      if (!isKnownReconnectError) {
        console.error(`[${connectionName}] Redis error:`, err.message);
      }
    });

    redis.on('close', () => {
      // Suppress noisy close events in development
      if (!isDev) {
        console.warn(`[${connectionName}] Redis connection closed`);
      }
    });

    redis.on('reconnecting', delay => {
      // Suppress noisy reconnecting events in development
      if (!isDev) {
        console.warn(`[${connectionName}] Redis reconnecting in ${delay}ms`);
      }
    });

    redis.on('end', () => {
      // Suppress noisy end events in development
      if (!isDev) {
        console.warn(`[${connectionName}] Redis connection ended`);
      }
    });
  }

  /**
   * Cleanup method para cerrar todas las conexiones del pool
   */
  async closeAllConnections(): Promise<void> {
    const connections = Array.from(this.connectionPool.values());
    this.connectionPool.clear();

    await Promise.all(
      connections.map(async redis => {
        try {
          await redis.quit();
        } catch (error) {
          // Ignore errors during cleanup
          console.warn('Error closing Redis connection during cleanup:', error);
        }
      }),
    );
  }

  /**
   * Get connection pool status for debugging
   */
  getPoolStatus() {
    return {
      activeConnections: this.connectionPool.size,
      connections: Array.from(this.connectionPool.keys()),
    };
  }
}

/**
 * Token para inyección de dependencias
 */
export const REDIS_CONNECTION_FACTORY = Symbol('REDIS_CONNECTION_FACTORY');
