import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { RedisService } from './redis.service';

/**
 * Redis Module for distributed caching and rate limiting
 * 
 * Optimized for 1M+ concurrent users:
 * - Cluster support for horizontal scaling
 * - Connection pooling for high throughput
 * - Circuit breaker for Redis failures
 * - Automatic failover and retry logic
 */
@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: 'REDIS_CLIENT',
      useFactory: (configService: ConfigService) => {
        const redisConfig = {
          // Primary Redis configuration for 1M users
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
          password: configService.get<string>('REDIS_PASSWORD'),
          db: configService.get<number>('REDIS_DB', 0),
          
          // Connection pool optimized for high concurrency
          maxRetriesPerRequest: 3,
          retryDelayOnFailover: 100,
          enableReadyCheck: true,
          maxRetriesPerRequest: 3,
          lazyConnect: true,
          
          // Connection pool settings for 1M users
          // Each app instance needs 50-100 Redis connections
          family: 4,
          keepAlive: true,
          connectTimeout: 10000,
          commandTimeout: 5000,
          
          // Memory optimization
          keyPrefix: configService.get<string>('REDIS_KEY_PREFIX', 'nauto:'),
          
          // Cluster configuration for horizontal scaling
          ...(configService.get<boolean>('REDIS_CLUSTER_ENABLED', false) && {
            enableOfflineQueue: false,
            redisOptions: {
              password: configService.get<string>('REDIS_PASSWORD'),
            },
          }),
        };

        // Create cluster or standalone Redis client
        if (configService.get<boolean>('REDIS_CLUSTER_ENABLED', false)) {
          const clusterNodes = configService.get<string>('REDIS_CLUSTER_NODES', 'localhost:6379').split(',');
          return new Redis.Cluster(clusterNodes.map(node => {
            const [host, port] = node.split(':');
            return { host, port: parseInt(port) };
          }), {
            redisOptions: redisConfig,
            enableReadyCheck: true,
            slotsRefreshTimeout: 10000,
          });
        }

        return new Redis(redisConfig);
      },
      inject: [ConfigService],
    },
    {
      provide: 'REDIS_RATE_LIMIT_CLIENT',
      useFactory: (configService: ConfigService) => {
        // Dedicated Redis client for rate limiting
        // Uses different DB to isolate rate limiting data
        return new Redis({
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
          password: configService.get<string>('REDIS_PASSWORD'),
          db: configService.get<number>('REDIS_RATE_LIMIT_DB', 1),
          keyPrefix: 'rl:',
          
          // Optimized for high-frequency rate limiting operations
          maxRetriesPerRequest: 1, // Fast fail for rate limiting
          commandTimeout: 1000, // 1 second timeout for rate checks
          lazyConnect: true,
        });
      },
      inject: [ConfigService],
    },
    {
      provide: 'REDIS_SESSION_CLIENT',
      useFactory: (configService: ConfigService) => {
        // Dedicated Redis client for session storage
        return new Redis({
          host: configService.get<string>('REDIS_HOST', 'localhost'),
          port: configService.get<number>('REDIS_PORT', 6379),
          password: configService.get<string>('REDIS_PASSWORD'),
          db: configService.get<number>('REDIS_SESSION_DB', 2),
          keyPrefix: 'sess:',
          
          // Session-optimized settings
          maxRetriesPerRequest: 2,
          commandTimeout: 3000,
          lazyConnect: true,
        });
      },
      inject: [ConfigService],
    },
    RedisService,
  ],
  exports: ['REDIS_CLIENT', 'REDIS_RATE_LIMIT_CLIENT', 'REDIS_SESSION_CLIENT', RedisService],
})
export class RedisModule {}