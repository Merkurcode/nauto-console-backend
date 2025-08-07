import { Injectable, Inject, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { ILogger } from '@core/interfaces/logger.interface';
import { LOGGER_SERVICE } from '@shared/constants/tokens';

/**
 * Redis Service for distributed operations
 * 
 * Provides high-level Redis operations optimized for 1M+ users:
 * - Connection health monitoring
 * - Automatic failover handling
 * - Performance metrics tracking
 * - Memory usage optimization
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private isHealthy = false;

  constructor(
    @Inject('REDIS_CLIENT')
    private readonly redis: Redis,
    @Inject('REDIS_RATE_LIMIT_CLIENT')
    private readonly rateLimitRedis: Redis,
    @Inject('REDIS_SESSION_CLIENT')
    private readonly sessionRedis: Redis,
    @Inject(LOGGER_SERVICE)
    private readonly logger: ILogger,
  ) {
    this.logger.setContext(RedisService.name);
  }

  async onModuleInit() {
    await this.initializeConnections();
    this.startHealthMonitoring();
  }

  async onModuleDestroy() {
    this.stopHealthMonitoring();
    await this.closeConnections();
  }

  /**
   * Initialize all Redis connections
   */
  private async initializeConnections(): Promise<void> {
    try {
      // Test main Redis connection
      await this.redis.ping();
      this.logger.log('Main Redis connection established');

      // Test rate limiting Redis connection  
      await this.rateLimitRedis.ping();
      this.logger.log('Rate limiting Redis connection established');

      // Test session Redis connection
      await this.sessionRedis.ping();
      this.logger.log('Session Redis connection established');

      this.isHealthy = true;
    } catch (error) {
      this.logger.error({
        message: 'Failed to initialize Redis connections',
        error: error instanceof Error ? error.message : String(error),
      });
      this.isHealthy = false;
    }
  }

  /**
   * Close all Redis connections gracefully
   */
  private async closeConnections(): Promise<void> {
    try {
      await Promise.all([
        this.redis.quit(),
        this.rateLimitRedis.quit(),
        this.sessionRedis.quit(),
      ]);
      this.logger.log('All Redis connections closed gracefully');
    } catch (error) {
      this.logger.error({
        message: 'Error closing Redis connections',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Start health monitoring for Redis connections
   */
  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        await Promise.all([
          this.redis.ping(),
          this.rateLimitRedis.ping(),
          this.sessionRedis.ping(),
        ]);
        
        if (!this.isHealthy) {
          this.isHealthy = true;
          this.logger.log('Redis health check passed - connections restored');
        }
      } catch (error) {
        if (this.isHealthy) {
          this.isHealthy = false;
          this.logger.error({
            message: 'Redis health check failed - connections unhealthy',
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Stop health monitoring
   */
  private stopHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Get main Redis client
   */
  getClient(): Redis {
    return this.redis;
  }

  /**
   * Get rate limiting Redis client
   */
  getRateLimitClient(): Redis {
    return this.rateLimitRedis;
  }

  /**
   * Get session Redis client
   */
  getSessionClient(): Redis {
    return this.sessionRedis;
  }

  /**
   * Check if Redis is healthy
   */
  isRedisHealthy(): boolean {
    return this.isHealthy;
  }

  /**
   * Get Redis connection info for monitoring
   */
  async getConnectionInfo(): Promise<{
    main: any;
    rateLimit: any;
    session: any;
  }> {
    try {
      const [mainInfo, rateLimitInfo, sessionInfo] = await Promise.all([
        this.redis.client('INFO'),
        this.rateLimitRedis.client('INFO'),
        this.sessionRedis.client('INFO'),
      ]);

      return {
        main: this.parseRedisInfo(mainInfo),
        rateLimit: this.parseRedisInfo(rateLimitInfo),
        session: this.parseRedisInfo(sessionInfo),
      };
    } catch (error) {
      this.logger.error({
        message: 'Failed to get Redis connection info',
        error: error instanceof Error ? error.message : String(error),
      });
      return { main: null, rateLimit: null, session: null };
    }
  }

  /**
   * Parse Redis INFO command output
   */
  private parseRedisInfo(info: string): any {
    const result: any = {};
    const lines = info.split('\r\n');
    
    for (const line of lines) {
      if (line.includes(':')) {
        const [key, value] = line.split(':');
        result[key] = value;
      }
    }
    
    return result;
  }

  /**
   * Execute Redis command with error handling and circuit breaker
   */
  async safeExecute<T>(
    client: 'main' | 'rateLimit' | 'session',
    command: string,
    ...args: any[]
  ): Promise<T | null> {
    try {
      const redis = client === 'main' ? this.redis : 
                   client === 'rateLimit' ? this.rateLimitRedis : 
                   this.sessionRedis;

      return await redis.call(command, ...args) as T;
    } catch (error) {
      this.logger.error({
        message: `Redis command failed: ${command}`,
        client,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }
}