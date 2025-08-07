import { Injectable, Inject, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ILogger } from '@core/interfaces/logger.interface';
import { LOGGER_SERVICE } from '@shared/constants/tokens';
import { OptimizedPrismaService } from '@infrastructure/database/prisma/optimized-prisma.service';
import { RedisService } from '@infrastructure/redis/redis.service';
import { DistributedRateLimiterService } from './distributed-rate-limiter.service';
import { DistributedCircuitBreakerService } from './distributed-circuit-breaker.service';
import { WorkerSessionMonitorService } from './worker-session-monitor.service';

export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
}

interface IHealthCheck {
  name: string;
  status: HealthStatus;
  responseTime: number;
  message?: string;
  metadata?: Record<string, any>;
}

interface ISystemHealth {
  overall: HealthStatus;
  checks: IHealthCheck[];
  timestamp: number;
  version: string;
  uptime: number;
  performance: {
    avgResponseTime: number;
    throughput: number;
    errorRate: number;
    activeConnections: number;
  };
}

/**
 * Optimized Health Check Service
 * 
 * High-performance health monitoring for 1M+ users:
 * - Non-blocking health checks with timeouts
 * - Cached results to prevent overhead
 * - Circuit breaker integration
 * - Performance metrics aggregation
 * - Distributed health state
 * - Graceful degradation detection
 */
@Injectable()
export class OptimizedHealthService implements OnModuleInit, OnModuleDestroy {
  private healthCache = new Map<string, { result: IHealthCheck; expiry: number }>();
  private readonly CACHE_TTL = 30000; // 30 seconds cache
  private readonly HEALTH_CHECK_TIMEOUT = 5000; // 5 seconds timeout
  
  private healthInterval: NodeJS.Timeout | null = null;
  private lastHealthCheck = 0;
  private consecutiveFailures = 0;
  private readonly MAX_CONSECUTIVE_FAILURES = 3;
  
  private performanceMetrics = {
    requestCount: 0,
    totalResponseTime: 0,
    errorCount: 0,
    startTime: Date.now(),
  };

  private healthCheckers: Map<string, () => Promise<IHealthCheck>> = new Map();

  constructor(
    private readonly configService: ConfigService,
    @Inject(LOGGER_SERVICE)
    private readonly logger: ILogger,
    private readonly optimizedPrisma: OptimizedPrismaService,
    private readonly redisService: RedisService,
    private readonly rateLimiter: DistributedRateLimiterService,
    private readonly circuitBreaker: DistributedCircuitBreakerService,
    private readonly sessionMonitor: WorkerSessionMonitorService,
  ) {
    this.logger.setContext(OptimizedHealthService.name);
    this.registerHealthCheckers();
  }

  async onModuleInit() {
    this.startPeriodicHealthChecks();
    this.logger.log('Optimized Health Service initialized');
  }

  async onModuleDestroy() {
    this.stopPeriodicHealthChecks();
  }

  /**
   * Get comprehensive system health status
   */
  async getHealth(includeDetails = true): Promise<ISystemHealth> {
    const startTime = Date.now();
    
    try {
      const checks: IHealthCheck[] = [];
      const checkPromises: Promise<IHealthCheck>[] = [];

      // Run health checks in parallel with timeout protection
      for (const [name, checker] of this.healthCheckers.entries()) {
        checkPromises.push(
          this.executeHealthCheckWithTimeout(name, checker)
        );
      }

      const results = await Promise.allSettled(checkPromises);
      
      // Process results
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const checkName = Array.from(this.healthCheckers.keys())[i];
        
        if (result.status === 'fulfilled') {
          checks.push(result.value);
        } else {
          checks.push({
            name: checkName,
            status: HealthStatus.UNHEALTHY,
            responseTime: this.HEALTH_CHECK_TIMEOUT,
            message: 'Health check timeout',
          });
        }
      }

      // Determine overall status
      const overall = this.calculateOverallHealth(checks);
      
      // Update performance metrics
      const responseTime = Date.now() - startTime;
      this.updatePerformanceMetrics(responseTime, false);
      
      const health: ISystemHealth = {
        overall,
        checks: includeDetails ? checks : [],
        timestamp: Date.now(),
        version: this.configService.get<string>('APP_VERSION', '1.0.0'),
        uptime: Date.now() - this.performanceMetrics.startTime,
        performance: this.getPerformanceMetrics(),
      };

      this.lastHealthCheck = Date.now();
      this.consecutiveFailures = overall === HealthStatus.HEALTHY ? 0 : this.consecutiveFailures + 1;

      return health;
    } catch (error) {
      this.updatePerformanceMetrics(Date.now() - startTime, true);
      this.consecutiveFailures++;
      
      this.logger.error({
        message: 'Health check failed',
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        overall: HealthStatus.UNHEALTHY,
        checks: [{
          name: 'system',
          status: HealthStatus.UNHEALTHY,
          responseTime: Date.now() - startTime,
          message: 'System health check failed',
        }],
        timestamp: Date.now(),
        version: this.configService.get<string>('APP_VERSION', '1.0.0'),
        uptime: Date.now() - this.performanceMetrics.startTime,
        performance: this.getPerformanceMetrics(),
      };
    }
  }

  /**
   * Get lightweight health status (cached)
   */
  async getLiveHealth(): Promise<{ status: HealthStatus; timestamp: number }> {
    const now = Date.now();
    
    // Return cached result if recent
    if (this.lastHealthCheck && (now - this.lastHealthCheck) < this.CACHE_TTL) {
      const isHealthy = this.consecutiveFailures < this.MAX_CONSECUTIVE_FAILURES;
      return {
        status: isHealthy ? HealthStatus.HEALTHY : HealthStatus.UNHEALTHY,
        timestamp: this.lastHealthCheck,
      };
    }

    // Quick health check (essential services only)
    const quickChecks = ['database', 'redis'];
    const results = await Promise.allSettled(
      quickChecks.map(name => {
        const checker = this.healthCheckers.get(name);
        return checker ? this.executeHealthCheckWithTimeout(name, checker) : 
               Promise.resolve({ name, status: HealthStatus.UNHEALTHY, responseTime: 0 });
      })
    );

    const hasFailures = results.some(result => 
      result.status === 'rejected' || 
      (result.status === 'fulfilled' && result.value.status !== HealthStatus.HEALTHY)
    );

    const status = hasFailures ? HealthStatus.DEGRADED : HealthStatus.HEALTHY;
    this.lastHealthCheck = now;

    return { status, timestamp: now };
  }

  /**
   * Register health checkers for different components
   */
  private registerHealthCheckers(): void {
    // Database health check
    this.healthCheckers.set('database', async (): Promise<IHealthCheck> => {
      const startTime = Date.now();
      
      try {
        const connectionStats = this.optimizedPrisma.getConnectionStats();
        const isHealthy = connectionStats.connections.healthy && connectionStats.errorCount < 10;
        
        return {
          name: 'database',
          status: isHealthy ? HealthStatus.HEALTHY : HealthStatus.DEGRADED,
          responseTime: Date.now() - startTime,
          message: isHealthy ? 'Database connections healthy' : 'Database has errors',
          metadata: {
            connections: connectionStats.connections,
            avgQueryTime: connectionStats.avgQueryTime,
            errorCount: connectionStats.errorCount,
          },
        };
      } catch (error) {
        return {
          name: 'database',
          status: HealthStatus.UNHEALTHY,
          responseTime: Date.now() - startTime,
          message: 'Database health check failed',
          metadata: { error: error instanceof Error ? error.message : String(error) },
        };
      }
    });

    // Redis health check
    this.healthCheckers.set('redis', async (): Promise<IHealthCheck> => {
      const startTime = Date.now();
      
      try {
        const isHealthy = this.redisService.isRedisHealthy();
        
        return {
          name: 'redis',
          status: isHealthy ? HealthStatus.HEALTHY : HealthStatus.UNHEALTHY,
          responseTime: Date.now() - startTime,
          message: isHealthy ? 'Redis connections healthy' : 'Redis connections unhealthy',
        };
      } catch (error) {
        return {
          name: 'redis',
          status: HealthStatus.UNHEALTHY,
          responseTime: Date.now() - startTime,
          message: 'Redis health check failed',
        };
      }
    });

    // Rate limiter health check
    this.healthCheckers.set('rate_limiter', async (): Promise<IHealthCheck> => {
      const startTime = Date.now();
      
      try {
        const stats = await this.rateLimiter.getStatistics();
        const isHealthy = stats.redisHealthy && stats.fallbackKeys < 1000; // Reasonable fallback threshold
        
        return {
          name: 'rate_limiter',
          status: isHealthy ? HealthStatus.HEALTHY : HealthStatus.DEGRADED,
          responseTime: Date.now() - startTime,
          message: isHealthy ? 'Rate limiter healthy' : 'Rate limiter using fallback',
          metadata: stats,
        };
      } catch (error) {
        return {
          name: 'rate_limiter',
          status: HealthStatus.UNHEALTHY,
          responseTime: Date.now() - startTime,
          message: 'Rate limiter health check failed',
        };
      }
    });

    // Circuit breaker health check
    this.healthCheckers.set('circuit_breakers', async (): Promise<IHealthCheck> => {
      const startTime = Date.now();
      
      try {
        const states = await this.circuitBreaker.getAllCircuitStates();
        const openCircuits = states.filter(s => s.state === 'open');
        
        const status = openCircuits.length === 0 ? HealthStatus.HEALTHY :
                      openCircuits.length <= 2 ? HealthStatus.DEGRADED :
                      HealthStatus.UNHEALTHY;
        
        return {
          name: 'circuit_breakers',
          status,
          responseTime: Date.now() - startTime,
          message: `${openCircuits.length} circuit breakers open`,
          metadata: {
            totalCircuits: states.length,
            openCircuits: openCircuits.length,
            openServices: openCircuits.map(c => c.serviceName),
          },
        };
      } catch (error) {
        return {
          name: 'circuit_breakers',
          status: HealthStatus.UNHEALTHY,
          responseTime: Date.now() - startTime,
          message: 'Circuit breaker health check failed',
        };
      }
    });

    // Session monitor health check
    this.healthCheckers.set('session_monitor', async (): Promise<IHealthCheck> => {
      const startTime = Date.now();
      
      try {
        const workerHealth = this.sessionMonitor.getWorkerHealth();
        const metrics = this.sessionMonitor.getMetrics();
        
        const status = workerHealth.ready && workerHealth.restartCount < 3 ? 
                      HealthStatus.HEALTHY : HealthStatus.DEGRADED;
        
        return {
          name: 'session_monitor',
          status,
          responseTime: Date.now() - startTime,
          message: workerHealth.ready ? 'Session monitor worker healthy' : 'Session monitor worker issues',
          metadata: {
            workerReady: workerHealth.ready,
            restartCount: workerHealth.restartCount,
            activeSessions: metrics.activeSessions,
            memoryUsage: metrics.memoryUsage,
          },
        };
      } catch (error) {
        return {
          name: 'session_monitor',
          status: HealthStatus.UNHEALTHY,
          responseTime: Date.now() - startTime,
          message: 'Session monitor health check failed',
        };
      }
    });

    // Memory health check
    this.healthCheckers.set('memory', async (): Promise<IHealthCheck> => {
      const startTime = Date.now();
      
      try {
        const memUsage = process.memoryUsage();
        const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
        const heapTotalMB = memUsage.heapTotal / 1024 / 1024;
        const heapUtilization = (heapUsedMB / heapTotalMB) * 100;
        
        const status = heapUtilization < 80 ? HealthStatus.HEALTHY :
                      heapUtilization < 90 ? HealthStatus.DEGRADED :
                      HealthStatus.UNHEALTHY;
        
        return {
          name: 'memory',
          status,
          responseTime: Date.now() - startTime,
          message: `Memory utilization: ${heapUtilization.toFixed(1)}%`,
          metadata: {
            heapUsedMB: Math.round(heapUsedMB),
            heapTotalMB: Math.round(heapTotalMB),
            heapUtilization: Math.round(heapUtilization),
            rss: Math.round(memUsage.rss / 1024 / 1024),
            external: Math.round(memUsage.external / 1024 / 1024),
          },
        };
      } catch (error) {
        return {
          name: 'memory',
          status: HealthStatus.UNHEALTHY,
          responseTime: Date.now() - startTime,
          message: 'Memory health check failed',
        };
      }
    });
  }

  /**
   * Execute health check with timeout protection
   */
  private async executeHealthCheckWithTimeout(
    name: string,
    checker: () => Promise<IHealthCheck>
  ): Promise<IHealthCheck> {
    // Check cache first
    const cached = this.healthCache.get(name);
    if (cached && Date.now() < cached.expiry) {
      return cached.result;
    }

    // Execute with timeout
    const timeoutPromise = new Promise<IHealthCheck>((_, reject) => {
      setTimeout(() => reject(new Error('Health check timeout')), this.HEALTH_CHECK_TIMEOUT);
    });

    try {
      const result = await Promise.race([checker(), timeoutPromise]);
      
      // Cache the result
      this.healthCache.set(name, {
        result,
        expiry: Date.now() + this.CACHE_TTL,
      });
      
      return result;
    } catch (error) {
      const result: IHealthCheck = {
        name,
        status: HealthStatus.UNHEALTHY,
        responseTime: this.HEALTH_CHECK_TIMEOUT,
        message: error instanceof Error ? error.message : 'Health check failed',
      };
      
      return result;
    }
  }

  /**
   * Calculate overall system health based on individual checks
   */
  private calculateOverallHealth(checks: IHealthCheck[]): HealthStatus {
    if (checks.length === 0) return HealthStatus.UNHEALTHY;

    const healthyCount = checks.filter(c => c.status === HealthStatus.HEALTHY).length;
    const degradedCount = checks.filter(c => c.status === HealthStatus.DEGRADED).length;
    const unhealthyCount = checks.filter(c => c.status === HealthStatus.UNHEALTHY).length;

    // Critical services that must be healthy
    const criticalServices = ['database', 'redis'];
    const criticalChecks = checks.filter(c => criticalServices.includes(c.name));
    const criticalUnhealthy = criticalChecks.filter(c => c.status === HealthStatus.UNHEALTHY).length;

    if (criticalUnhealthy > 0) {
      return HealthStatus.UNHEALTHY;
    }

    if (unhealthyCount > checks.length * 0.3) { // More than 30% unhealthy
      return HealthStatus.UNHEALTHY;
    }

    if (degradedCount > 0 || unhealthyCount > 0) {
      return HealthStatus.DEGRADED;
    }

    return HealthStatus.HEALTHY;
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(responseTime: number, isError: boolean): void {
    this.performanceMetrics.requestCount++;
    this.performanceMetrics.totalResponseTime += responseTime;
    
    if (isError) {
      this.performanceMetrics.errorCount++;
    }
  }

  /**
   * Get current performance metrics
   */
  private getPerformanceMetrics(): {
    avgResponseTime: number;
    throughput: number;
    errorRate: number;
    activeConnections: number;
  } {
    const uptime = Date.now() - this.performanceMetrics.startTime;
    
    return {
      avgResponseTime: this.performanceMetrics.requestCount > 0 ? 
        this.performanceMetrics.totalResponseTime / this.performanceMetrics.requestCount : 0,
      throughput: this.performanceMetrics.requestCount / (uptime / 1000), // requests per second
      errorRate: this.performanceMetrics.requestCount > 0 ? 
        (this.performanceMetrics.errorCount / this.performanceMetrics.requestCount) * 100 : 0,
      activeConnections: this.optimizedPrisma.getConnectionStats().connections.read + 
                        this.optimizedPrisma.getConnectionStats().connections.write,
    };
  }

  /**
   * Start periodic health checks
   */
  private startPeriodicHealthChecks(): void {
    const interval = this.configService.get<number>('HEALTH_CHECK_INTERVAL', 60000); // 1 minute
    
    this.healthInterval = setInterval(async () => {
      try {
        await this.getHealth(false); // Run background health check without details
      } catch (error) {
        this.logger.error({
          message: 'Periodic health check failed',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }, interval);
  }

  /**
   * Stop periodic health checks
   */
  private stopPeriodicHealthChecks(): void {
    if (this.healthInterval) {
      clearInterval(this.healthInterval);
      this.healthInterval = null;
    }
  }

  /**
   * Clear health cache
   */
  clearCache(): void {
    this.healthCache.clear();
  }

  /**
   * Get health check statistics
   */
  getHealthStatistics(): {
    totalChecks: number;
    consecutiveFailures: number;
    lastCheckTime: number;
    cacheSize: number;
    performanceMetrics: typeof this.performanceMetrics;
  } {
    return {
      totalChecks: this.performanceMetrics.requestCount,
      consecutiveFailures: this.consecutiveFailures,
      lastCheckTime: this.lastHealthCheck,
      cacheSize: this.healthCache.size,
      performanceMetrics: { ...this.performanceMetrics },
    };
  }
}