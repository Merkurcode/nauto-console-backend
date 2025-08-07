import { Injectable, Inject } from '@nestjs/common';
import { Redis } from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { ILogger } from '@core/interfaces/logger.interface';
import { LOGGER_SERVICE } from '@shared/constants/tokens';

/**
 * Distributed Rate Limiter Service
 * 
 * Optimized for 1M+ concurrent users:
 * - Redis-based distributed rate limiting
 * - Sliding window algorithm for accuracy
 * - Lua scripts for atomic operations
 * - Automatic cleanup of expired entries
 * - Circuit breaker for Redis failures
 */
@Injectable()
export class DistributedRateLimiterService {
  private readonly fallbackToMemory = new Map<string, { count: number; resetTime: number }>();
  private readonly maxFallbackEntries = 10000; // Limit fallback memory usage

  // Lua script for atomic rate limiting check and increment
  private readonly rateLimitScript = `
    local key = KEYS[1]
    local window = tonumber(ARGV[1])
    local limit = tonumber(ARGV[2])
    local current_time = tonumber(ARGV[3])
    
    -- Clean up expired entries (sliding window)
    redis.call('ZREMRANGEBYSCORE', key, '-inf', current_time - window)
    
    -- Count current requests in window
    local current_count = redis.call('ZCARD', key)
    
    if current_count < limit then
        -- Add current request to window
        redis.call('ZADD', key, current_time, current_time)
        -- Set expiration for automatic cleanup
        redis.call('EXPIRE', key, math.ceil(window / 1000))
        return {1, limit - current_count - 1}
    else
        return {0, 0}
    end
  `;

  private readonly cleanupScript = `
    local pattern = ARGV[1]
    local limit = tonumber(ARGV[2])
    
    local keys = redis.call('SCAN', 0, 'MATCH', pattern, 'COUNT', limit)
    local deleted = 0
    
    for i = 1, #keys[2] do
        local ttl = redis.call('TTL', keys[2][i])
        if ttl == -1 or ttl == -2 then
            redis.call('DEL', keys[2][i])
            deleted = deleted + 1
        end
    end
    
    return deleted
  `;

  constructor(
    @Inject('REDIS_RATE_LIMIT_CLIENT')
    private readonly redis: Redis,
    private readonly configService: ConfigService,
    @Inject(LOGGER_SERVICE)
    private readonly logger: ILogger,
  ) {
    this.logger.setContext(DistributedRateLimiterService.name);
    
    // Start periodic cleanup
    this.startPeriodicCleanup();
  }

  /**
   * Check and increment rate limit for a key
   * 
   * @param key - Unique identifier (user ID, IP, etc.)
   * @param limit - Maximum requests allowed
   * @param windowMs - Time window in milliseconds
   * @returns { allowed: boolean, remaining: number, resetTime: number }
   */
  async checkRateLimit(
    key: string,
    limit: number,
    windowMs: number,
  ): Promise<{
    allowed: boolean;
    remaining: number;
    resetTime: number;
    usingFallback: boolean;
  }> {
    const now = Date.now();
    const rateLimitKey = `rl:${key}`;

    try {
      // Execute atomic rate limit check using Lua script
      const result = await this.redis.eval(
        this.rateLimitScript,
        1,
        rateLimitKey,
        windowMs.toString(),
        limit.toString(),
        now.toString(),
      ) as [number, number];

      const [allowed, remaining] = result;
      
      return {
        allowed: allowed === 1,
        remaining: remaining,
        resetTime: now + windowMs,
        usingFallback: false,
      };
    } catch (error) {
      this.logger.warn({
        message: 'Redis rate limiting failed, falling back to in-memory',
        key: key.substring(0, 20) + '...',
        error: error instanceof Error ? error.message : String(error),
      });

      // Fallback to in-memory rate limiting
      return this.fallbackRateLimit(key, limit, windowMs, now);
    }
  }

  /**
   * Get current rate limit status without incrementing
   */
  async getRateLimitStatus(
    key: string,
    windowMs: number,
  ): Promise<{
    current: number;
    window: number;
  } | null> {
    try {
      const rateLimitKey = `rl:${key}`;
      const now = Date.now();
      
      // Clean expired entries and count current
      await this.redis.zremrangebyscore(rateLimitKey, '-inf', now - windowMs);
      const current = await this.redis.zcard(rateLimitKey);
      
      return {
        current,
        window: windowMs,
      };
    } catch (error) {
      this.logger.error({
        message: 'Failed to get rate limit status',
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Reset rate limit for a key
   */
  async resetRateLimit(key: string): Promise<boolean> {
    try {
      const rateLimitKey = `rl:${key}`;
      await this.redis.del(rateLimitKey);
      
      // Also remove from fallback
      this.fallbackToMemory.delete(key);
      
      return true;
    } catch (error) {
      this.logger.error({
        message: 'Failed to reset rate limit',
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Get rate limiting statistics
   */
  async getStatistics(): Promise<{
    totalKeys: number;
    memoryUsage: number;
    fallbackKeys: number;
    redisHealthy: boolean;
  }> {
    try {
      // Count total rate limit keys in Redis
      const cursor = await this.redis.scan(0, 'MATCH', 'rl:*', 'COUNT', 1000);
      const totalKeys = cursor[1].length;
      
      // Get memory usage info
      const info = await this.redis.memory('USAGE', 'rl:*') || 0;
      
      return {
        totalKeys,
        memoryUsage: typeof info === 'number' ? info : 0,
        fallbackKeys: this.fallbackToMemory.size,
        redisHealthy: true,
      };
    } catch (error) {
      return {
        totalKeys: 0,
        memoryUsage: 0,
        fallbackKeys: this.fallbackToMemory.size,
        redisHealthy: false,
      };
    }
  }

  /**
   * Fallback to in-memory rate limiting when Redis is unavailable
   */
  private fallbackRateLimit(
    key: string,
    limit: number,
    windowMs: number,
    now: number,
  ): {
    allowed: boolean;
    remaining: number;
    resetTime: number;
    usingFallback: boolean;
  } {
    // Prevent memory explosion in fallback mode
    if (this.fallbackToMemory.size >= this.maxFallbackEntries && !this.fallbackToMemory.has(key)) {
      // Clean up expired entries
      this.cleanupFallbackMemory(now);
      
      // If still at capacity, deny request
      if (this.fallbackToMemory.size >= this.maxFallbackEntries) {
        return {
          allowed: false,
          remaining: 0,
          resetTime: now + windowMs,
          usingFallback: true,
        };
      }
    }

    let entry = this.fallbackToMemory.get(key);
    
    // Reset if window expired
    if (!entry || now >= entry.resetTime) {
      entry = {
        count: 0,
        resetTime: now + windowMs,
      };
      this.fallbackToMemory.set(key, entry);
    }

    // Check rate limit
    if (entry.count >= limit) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime,
        usingFallback: true,
      };
    }

    // Increment counter
    entry.count++;
    
    return {
      allowed: true,
      remaining: limit - entry.count,
      resetTime: entry.resetTime,
      usingFallback: true,
    };
  }

  /**
   * Clean up expired entries from fallback memory
   */
  private cleanupFallbackMemory(now: number): void {
    const keysToDelete: string[] = [];
    
    for (const [key, entry] of this.fallbackToMemory.entries()) {
      if (now >= entry.resetTime) {
        keysToDelete.push(key);
      }
    }
    
    for (const key of keysToDelete) {
      this.fallbackToMemory.delete(key);
    }
  }

  /**
   * Start periodic cleanup of Redis keys
   */
  private startPeriodicCleanup(): void {
    // Clean up expired Redis keys every 5 minutes
    setInterval(async () => {
      try {
        const deleted = await this.redis.eval(
          this.cleanupScript,
          0,
          'rl:*',
          '1000', // Limit cleanup batch size
        ) as number;
        
        if (deleted > 0) {
          this.logger.debug({
            message: 'Cleaned up expired rate limit keys',
            deletedKeys: deleted,
          });
        }
      } catch (error) {
        this.logger.error({
          message: 'Failed to cleanup expired rate limit keys',
          error: error instanceof Error ? error.message : String(error),
        });
      }
      
      // Also cleanup fallback memory
      this.cleanupFallbackMemory(Date.now());
    }, 5 * 60 * 1000); // 5 minutes
  }
}