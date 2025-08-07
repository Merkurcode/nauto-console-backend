import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { Redis } from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { ILogger } from '@core/interfaces/logger.interface';
import { LOGGER_SERVICE } from '@shared/constants/tokens';
import { UserId } from '@core/value-objects/user-id.value-object';
import { DistributedRateLimiterService } from './distributed-rate-limiter.service';

interface ISessionData {
  userId: string;
  companyId: string;
  email: string;
  role: string;
  permissions: string[];
  createdAt: number;
  lastAccessedAt: number;
  ipAddress: string;
  userAgent: string;
  metadata?: Record<string, any>;
}

interface ISessionMetrics {
  sessionId: string;
  accessCount: number;
  lastAccess: number;
  createdAt: number;
  ttl: number;
}

/**
 * Distributed Session Storage Service
 * 
 * Redis-based session management for 1M+ concurrent users:
 * - Distributed session storage across multiple instances
 * - Session clustering and replication
 * - Automatic session cleanup and expiration
 * - Session analytics and monitoring
 * - Rate limiting integration
 * - Session security validation
 * - Horizontal scaling support
 */
@Injectable()
export class DistributedSessionService implements OnModuleInit {
  private readonly SESSION_PREFIX = 'session:';
  private readonly USER_SESSIONS_PREFIX = 'user_sessions:';
  private readonly SESSION_METRICS_PREFIX = 'session_metrics:';
  
  private readonly DEFAULT_SESSION_TTL: number;
  private readonly MAX_SESSIONS_PER_USER: number;
  private readonly SESSION_CLEANUP_BATCH_SIZE: number;
  
  private cleanupInterval: NodeJS.Timeout | null = null;
  private metricsInterval: NodeJS.Timeout | null = null;

  constructor(
    @Inject('REDIS_SESSION_CLIENT')
    private readonly sessionRedis: Redis,
    @Inject('REDIS_CLIENT')
    private readonly generalRedis: Redis,
    private readonly configService: ConfigService,
    @Inject(LOGGER_SERVICE)
    private readonly logger: ILogger,
    private readonly rateLimiter: DistributedRateLimiterService,
  ) {
    this.logger.setContext(DistributedSessionService.name);
    
    // Load configuration
    this.DEFAULT_SESSION_TTL = this.configService.get<number>('SESSION_TTL', 3600); // 1 hour in seconds
    this.MAX_SESSIONS_PER_USER = this.configService.get<number>('MAX_SESSIONS_PER_USER', 10);
    this.SESSION_CLEANUP_BATCH_SIZE = this.configService.get<number>('SESSION_CLEANUP_BATCH_SIZE', 1000);
  }

  async onModuleInit() {
    this.startPeriodicCleanup();
    this.startMetricsCollection();
    this.logger.log('Distributed Session Service initialized');
  }

  /**
   * Create a new session
   */
  async createSession(
    sessionId: string,
    sessionData: Omit<ISessionData, 'createdAt' | 'lastAccessedAt'>,
  ): Promise<boolean> {
    try {
      // Rate limit session creation per user
      const rateLimitKey = `session_create:${sessionData.userId}`;
      const rateCheck = await this.rateLimiter.checkRateLimit(rateLimitKey, 10, 60000); // 10 sessions per minute
      
      if (!rateCheck.allowed) {
        this.logger.warn({
          message: 'Session creation rate limit exceeded',
          userId: sessionData.userId,
        });
        return false;
      }

      const now = Date.now();
      const fullSessionData: ISessionData = {
        ...sessionData,
        createdAt: now,
        lastAccessedAt: now,
      };

      // Enforce max sessions per user
      await this.enforceMaxSessionsPerUser(sessionData.userId, sessionId);

      // Use pipeline for atomic operations
      const pipeline = this.sessionRedis.pipeline();
      
      // Store session data
      const sessionKey = this.SESSION_PREFIX + sessionId;
      pipeline.hmset(sessionKey, this.serializeSessionData(fullSessionData));
      pipeline.expire(sessionKey, this.DEFAULT_SESSION_TTL);
      
      // Add to user's session set
      const userSessionsKey = this.USER_SESSIONS_PREFIX + sessionData.userId;
      pipeline.sadd(userSessionsKey, sessionId);
      pipeline.expire(userSessionsKey, this.DEFAULT_SESSION_TTL * 2); // Longer TTL for tracking
      
      // Store session metrics
      const metricsKey = this.SESSION_METRICS_PREFIX + sessionId;
      const metrics: ISessionMetrics = {
        sessionId,
        accessCount: 0,
        lastAccess: now,
        createdAt: now,
        ttl: this.DEFAULT_SESSION_TTL,
      };
      pipeline.hmset(metricsKey, metrics);
      pipeline.expire(metricsKey, this.DEFAULT_SESSION_TTL);
      
      await pipeline.exec();
      
      this.logger.debug({
        message: 'Session created successfully',
        sessionId: sessionId.substring(0, 8) + '...',
        userId: sessionData.userId,
      });
      
      return true;
    } catch (error) {
      this.logger.error({
        message: 'Failed to create session',
        sessionId: sessionId.substring(0, 8) + '...',
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Get session data
   */
  async getSession(sessionId: string): Promise<ISessionData | null> {
    try {
      const sessionKey = this.SESSION_PREFIX + sessionId;
      const sessionHash = await this.sessionRedis.hgetall(sessionKey);
      
      if (!sessionHash || Object.keys(sessionHash).length === 0) {
        return null;
      }
      
      // Update last accessed time and metrics
      await this.updateSessionAccess(sessionId);
      
      return this.deserializeSessionData(sessionHash);
    } catch (error) {
      this.logger.error({
        message: 'Failed to get session',
        sessionId: sessionId.substring(0, 8) + '...',
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Update session data
   */
  async updateSession(
    sessionId: string,
    updates: Partial<Omit<ISessionData, 'createdAt' | 'sessionId'>>,
  ): Promise<boolean> {
    try {
      const sessionKey = this.SESSION_PREFIX + sessionId;
      
      // Check if session exists
      const exists = await this.sessionRedis.exists(sessionKey);
      if (!exists) {
        return false;
      }
      
      const pipeline = this.sessionRedis.pipeline();
      
      // Update session data
      const updateData = {
        ...updates,
        lastAccessedAt: Date.now(),
      };
      
      for (const [key, value] of Object.entries(updateData)) {
        if (value !== undefined) {
          pipeline.hset(sessionKey, key, this.serializeValue(value));
        }
      }
      
      // Extend TTL
      pipeline.expire(sessionKey, this.DEFAULT_SESSION_TTL);
      
      await pipeline.exec();
      
      this.logger.debug({
        message: 'Session updated successfully',
        sessionId: sessionId.substring(0, 8) + '...',
        updatedFields: Object.keys(updates),
      });
      
      return true;
    } catch (error) {
      this.logger.error({
        message: 'Failed to update session',
        sessionId: sessionId.substring(0, 8) + '...',
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Delete session
   */
  async deleteSession(sessionId: string): Promise<boolean> {
    try {
      const sessionKey = this.SESSION_PREFIX + sessionId;
      
      // Get session data first to remove from user's session set
      const sessionData = await this.sessionRedis.hgetall(sessionKey);
      
      const pipeline = this.sessionRedis.pipeline();
      
      // Delete session data
      pipeline.del(sessionKey);
      
      // Delete session metrics
      const metricsKey = this.SESSION_METRICS_PREFIX + sessionId;
      pipeline.del(metricsKey);
      
      // Remove from user's session set
      if (sessionData.userId) {
        const userSessionsKey = this.USER_SESSIONS_PREFIX + sessionData.userId;
        pipeline.srem(userSessionsKey, sessionId);
      }
      
      await pipeline.exec();
      
      this.logger.debug({
        message: 'Session deleted successfully',
        sessionId: sessionId.substring(0, 8) + '...',
      });
      
      return true;
    } catch (error) {
      this.logger.error({
        message: 'Failed to delete session',
        sessionId: sessionId.substring(0, 8) + '...',
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Get all sessions for a user
   */
  async getUserSessions(userId: string): Promise<string[]> {
    try {
      const userSessionsKey = this.USER_SESSIONS_PREFIX + userId;
      const sessionIds = await this.sessionRedis.smembers(userSessionsKey);
      
      // Validate sessions exist and remove stale references
      const validSessionIds: string[] = [];
      const pipeline = this.sessionRedis.pipeline();
      
      for (const sessionId of sessionIds) {
        pipeline.exists(this.SESSION_PREFIX + sessionId);
      }
      
      const results = await pipeline.exec();
      
      if (results) {
        for (let i = 0; i < sessionIds.length; i++) {
          const exists = results[i][1] as number;
          if (exists) {
            validSessionIds.push(sessionIds[i]);
          } else {
            // Remove stale reference
            this.sessionRedis.srem(userSessionsKey, sessionIds[i]);
          }
        }
      }
      
      return validSessionIds;
    } catch (error) {
      this.logger.error({
        message: 'Failed to get user sessions',
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Delete all sessions for a user
   */
  async deleteUserSessions(userId: string): Promise<number> {
    try {
      const sessionIds = await this.getUserSessions(userId);
      
      if (sessionIds.length === 0) {
        return 0;
      }
      
      const pipeline = this.sessionRedis.pipeline();
      
      // Delete all sessions
      for (const sessionId of sessionIds) {
        pipeline.del(this.SESSION_PREFIX + sessionId);
        pipeline.del(this.SESSION_METRICS_PREFIX + sessionId);
      }
      
      // Clear user sessions set
      const userSessionsKey = this.USER_SESSIONS_PREFIX + userId;
      pipeline.del(userSessionsKey);
      
      await pipeline.exec();
      
      this.logger.log({
        message: 'User sessions deleted',
        userId,
        deletedCount: sessionIds.length,
      });
      
      return sessionIds.length;
    } catch (error) {
      this.logger.error({
        message: 'Failed to delete user sessions',
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }

  /**
   * Get session statistics
   */
  async getSessionStatistics(): Promise<{
    totalSessions: number;
    activeSessions: number;
    expiredSessions: number;
    avgSessionDuration: number;
    topUsers: Array<{ userId: string; sessionCount: number }>;
  }> {
    try {
      // Get total session count
      const sessionKeys = await this.sessionRedis.keys(this.SESSION_PREFIX + '*');
      const totalSessions = sessionKeys.length;
      
      // Sample metrics for performance (don't process all sessions)
      const sampleSize = Math.min(100, totalSessions);
      const sampleKeys = sessionKeys.slice(0, sampleSize);
      
      let activeSessions = 0;
      let totalDuration = 0;
      let validDurations = 0;
      const userSessionCounts = new Map<string, number>();
      
      if (sampleKeys.length > 0) {
        const pipeline = this.sessionRedis.pipeline();
        
        for (const key of sampleKeys) {
          pipeline.hmget(key, 'createdAt', 'lastAccessedAt', 'userId');
        }
        
        const results = await pipeline.exec();
        const now = Date.now();
        
        if (results) {
          for (const result of results) {
            const [createdAt, lastAccessedAt, userId] = result[1] as string[];
            
            if (createdAt && lastAccessedAt) {
              const created = parseInt(createdAt);
              const lastAccessed = parseInt(lastAccessedAt);
              
              // Session is active if accessed within last hour
              if (now - lastAccessed < 3600000) {
                activeSessions++;
              }
              
              if (!isNaN(created) && !isNaN(lastAccessed)) {
                totalDuration += lastAccessed - created;
                validDurations++;
              }
              
              if (userId) {
                userSessionCounts.set(userId, (userSessionCounts.get(userId) || 0) + 1);
              }
            }
          }
        }
      }
      
      // Scale up from sample
      const scaleFactor = totalSessions / sampleSize;
      const estimatedActiveSessions = Math.round(activeSessions * scaleFactor);
      
      // Top users by session count
      const topUsers = Array.from(userSessionCounts.entries())
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([userId, sessionCount]) => ({ userId, sessionCount }));
      
      return {
        totalSessions,
        activeSessions: estimatedActiveSessions,
        expiredSessions: totalSessions - estimatedActiveSessions,
        avgSessionDuration: validDurations > 0 ? totalDuration / validDurations : 0,
        topUsers,
      };
    } catch (error) {
      this.logger.error({
        message: 'Failed to get session statistics',
        error: error instanceof Error ? error.message : String(error),
      });
      
      return {
        totalSessions: 0,
        activeSessions: 0,
        expiredSessions: 0,
        avgSessionDuration: 0,
        topUsers: [],
      };
    }
  }

  /**
   * Enforce maximum sessions per user
   */
  private async enforceMaxSessionsPerUser(userId: string, newSessionId: string): Promise<void> {
    try {
      const sessionIds = await this.getUserSessions(userId);
      
      if (sessionIds.length >= this.MAX_SESSIONS_PER_USER) {
        // Remove oldest sessions
        const sessionsToRemove = sessionIds.length - this.MAX_SESSIONS_PER_USER + 1;
        
        // Get creation times to determine oldest sessions
        const pipeline = this.sessionRedis.pipeline();
        for (const sessionId of sessionIds) {
          pipeline.hget(this.SESSION_PREFIX + sessionId, 'createdAt');
        }
        
        const results = await pipeline.exec();
        const sessionsWithTime = sessionIds
          .map((id, index) => ({
            id,
            createdAt: results && results[index] ? parseInt(results[index][1] as string) : 0,
          }))
          .sort((a, b) => a.createdAt - b.createdAt)
          .slice(0, sessionsToRemove);
        
        // Remove oldest sessions
        for (const session of sessionsWithTime) {
          await this.deleteSession(session.id);
        }
        
        this.logger.debug({
          message: 'Enforced max sessions per user',
          userId,
          removedSessions: sessionsToRemove,
        });
      }
    } catch (error) {
      this.logger.error({
        message: 'Failed to enforce max sessions per user',
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Update session access time and metrics
   */
  private async updateSessionAccess(sessionId: string): Promise<void> {
    try {
      const now = Date.now();
      const pipeline = this.sessionRedis.pipeline();
      
      // Update last accessed time in session
      const sessionKey = this.SESSION_PREFIX + sessionId;
      pipeline.hset(sessionKey, 'lastAccessedAt', now.toString());
      pipeline.expire(sessionKey, this.DEFAULT_SESSION_TTL);
      
      // Update metrics
      const metricsKey = this.SESSION_METRICS_PREFIX + sessionId;
      pipeline.hincrby(metricsKey, 'accessCount', 1);
      pipeline.hset(metricsKey, 'lastAccess', now.toString());
      pipeline.expire(metricsKey, this.DEFAULT_SESSION_TTL);
      
      await pipeline.exec();
    } catch (error) {
      // Don't log errors for access updates to prevent noise
    }
  }

  /**
   * Start periodic session cleanup
   */
  private startPeriodicCleanup(): void {
    const cleanupInterval = this.configService.get<number>('SESSION_CLEANUP_INTERVAL', 300000); // 5 minutes
    
    this.cleanupInterval = setInterval(async () => {
      await this.performCleanup();
    }, cleanupInterval);
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    const metricsInterval = this.configService.get<number>('SESSION_METRICS_INTERVAL', 600000); // 10 minutes
    
    this.metricsInterval = setInterval(async () => {
      try {
        const stats = await this.getSessionStatistics();
        this.logger.debug({
          message: 'Session statistics',
          ...stats,
        });
      } catch (error) {
        // Silent failure for metrics
      }
    }, metricsInterval);
  }

  /**
   * Perform session cleanup
   */
  private async performCleanup(): Promise<void> {
    try {
      // Get expired session keys
      const sessionKeys = await this.sessionRedis.keys(this.SESSION_PREFIX + '*');
      
      if (sessionKeys.length === 0) return;
      
      let cleanedCount = 0;
      
      // Process in batches
      for (let i = 0; i < sessionKeys.length; i += this.SESSION_CLEANUP_BATCH_SIZE) {
        const batch = sessionKeys.slice(i, i + this.SESSION_CLEANUP_BATCH_SIZE);
        
        const pipeline = this.sessionRedis.pipeline();
        for (const key of batch) {
          pipeline.ttl(key);
        }
        
        const ttlResults = await pipeline.exec();
        const expiredKeys = [];
        
        if (ttlResults) {
          for (let j = 0; j < batch.length; j++) {
            const ttl = ttlResults[j][1] as number;
            if (ttl === -2) { // Key doesn't exist
              expiredKeys.push(batch[j]);
            }
          }
        }
        
        // Clean up expired sessions
        if (expiredKeys.length > 0) {
          const cleanupPipeline = this.sessionRedis.pipeline();
          
          for (const key of expiredKeys) {
            const sessionId = key.replace(this.SESSION_PREFIX, '');
            cleanupPipeline.del(key);
            cleanupPipeline.del(this.SESSION_METRICS_PREFIX + sessionId);
          }
          
          await cleanupPipeline.exec();
          cleanedCount += expiredKeys.length;
        }
      }
      
      if (cleanedCount > 0) {
        this.logger.debug({
          message: 'Session cleanup completed',
          cleanedSessions: cleanedCount,
        });
      }
    } catch (error) {
      this.logger.error({
        message: 'Session cleanup failed',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Serialize session data for Redis storage
   */
  private serializeSessionData(data: ISessionData): Record<string, string> {
    const serialized: Record<string, string> = {};
    
    for (const [key, value] of Object.entries(data)) {
      serialized[key] = this.serializeValue(value);
    }
    
    return serialized;
  }

  /**
   * Deserialize session data from Redis
   */
  private deserializeSessionData(data: Record<string, string>): ISessionData {
    const deserialized: any = {};
    
    for (const [key, value] of Object.entries(data)) {
      deserialized[key] = this.deserializeValue(key, value);
    }
    
    return deserialized as ISessionData;
  }

  /**
   * Serialize a value for Redis storage
   */
  private serializeValue(value: any): string {
    if (Array.isArray(value) || typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  }

  /**
   * Deserialize a value from Redis
   */
  private deserializeValue(key: string, value: string): any {
    if (key === 'permissions' || key === 'metadata') {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    
    if (key === 'createdAt' || key === 'lastAccessedAt') {
      return parseInt(value);
    }
    
    return value;
  }
}