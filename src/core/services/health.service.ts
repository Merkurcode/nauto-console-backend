import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IDatabaseHealth } from '@core/interfaces/database-health.interface';
import { ILogger } from '@core/interfaces/logger.interface';
import { LOGGER_SERVICE, DATABASE_HEALTH } from '@shared/constants/tokens';
import {
  IHealthResponse,
  IDatabaseHealthResponse,
  IReadinessResponse,
  ILivenessResponse,
  IHealthCheckDetail,
  IComprehensiveHealthResponse,
} from '@application/dtos/_responses/health/health.response.interface';
import {
  HealthCheckException,
  DatabaseConnectionException,
  ConfigurationException,
} from '@core/exceptions/domain-exceptions';

/**
 * Health Service - Domain service for application health monitoring
 * Implements comprehensive health checking following DDD principles
 */
@Injectable()
export class HealthService {
  constructor(
    private readonly configService: ConfigService,
    @Inject(DATABASE_HEALTH)
    private readonly databaseHealth: IDatabaseHealth,
    @Inject(LOGGER_SERVICE)
    private readonly logger: ILogger,
  ) {}

  /**
   * Get basic application health status
   */
  async getHealth(): Promise<IHealthResponse> {
    this.logger.debug('Performing basic health check');

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: this.configService.get<string>('env', 'development'),
      version: this.getApplicationVersion(),
    };
  }

  /**
   * Get database health status with connection validation
   */
  async getDatabaseHealth(): Promise<IDatabaseHealthResponse> {
    this.logger.debug('Performing database health check');

    try {
      const startTime = performance.now();
      await this.checkDatabase();
      const duration = performance.now() - startTime;

      this.logger.debug(`Database health check completed in ${duration}ms`);

      return {
        status: 'ok',
        database: 'connected',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        'Database health check failed',
        undefined,
        JSON.stringify({ error: error.message }),
      );
      throw new DatabaseConnectionException('Database connection failed');
    }
  }

  /**
   * Kubernetes readiness probe - comprehensive service readiness
   */
  async getReadiness(): Promise<IReadinessResponse> {
    this.logger.debug('Performing readiness check');

    try {
      // Perform comprehensive readiness checks
      const checks = await Promise.allSettled([
        this.checkDatabase(),
        this.checkConfiguration(),
        this.checkExternalDependencies(),
      ]);

      const failedChecks = checks.filter(check => check.status === 'rejected');

      if (failedChecks.length > 0) {
        const failures = failedChecks.map((check, _index) =>
          check.status === 'rejected' ? check.reason?.message : 'Unknown error',
        );

        this.logger.error('Readiness check failed', undefined, JSON.stringify({ failures }));
        throw new HealthCheckException(`Service not ready: ${failures.join(', ')}`);
      }

      this.logger.debug('Readiness check passed');

      return {
        status: 'ready',
        timestamp: new Date().toISOString(),
        checks: {
          database: 'ok',
          config: 'ok',
        },
      };
    } catch (error) {
      this.logger.error(
        'Readiness check failed',
        undefined,
        JSON.stringify({ error: error.message }),
      );
      throw new HealthCheckException('Service not ready');
    }
  }

  /**
   * Kubernetes liveness probe - basic service availability
   */
  async getLiveness(): Promise<ILivenessResponse> {
    this.logger.debug('Performing liveness check');

    // Liveness should be lightweight - just verify the process is responsive
    return {
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  /**
   * Comprehensive health check with detailed information
   */
  async getComprehensiveHealth(): Promise<IComprehensiveHealthResponse> {
    this.logger.debug('Performing comprehensive health check');

    const checks: IHealthCheckDetail[] = [];
    let overallStatus: 'ok' | 'degraded' | 'down' = 'ok';

    // Database check
    const dbCheck = await this.performHealthCheck('database', async () => {
      await this.checkDatabase();
    });
    checks.push(dbCheck);

    // Configuration check
    const configCheck = await this.performHealthCheck('configuration', async () => {
      await this.checkConfiguration();
    });
    checks.push(configCheck);

    // External dependencies check
    const externalCheck = await this.performHealthCheck('external-services', async () => {
      await this.checkExternalDependencies();
    });
    checks.push(externalCheck);

    // Memory usage check
    const memoryCheck = await this.performHealthCheck('memory', async () => {
      await this.checkMemoryUsage();
    });
    checks.push(memoryCheck);

    // Determine overall status
    const errorCount = checks.filter(check => check.status === 'error').length;
    if (errorCount > 0) {
      overallStatus = errorCount >= checks.length / 2 ? 'down' : 'degraded';
    }

    this.logger.debug(
      'Comprehensive health check completed',
      JSON.stringify({
        overallStatus,
        checksCount: checks.length,
        errorsCount: errorCount,
      }),
    );

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: this.configService.get<string>('env', 'development'),
      version: this.getApplicationVersion(),
      checks,
    };
  }

  // Private helper methods

  private async checkDatabase(): Promise<void> {
    try {
      await this.databaseHealth.testConnection();
    } catch (error) {
      throw new DatabaseConnectionException(`Database check failed: ${error.message}`);
    }
  }

  private async checkConfiguration(): Promise<void> {
    const requiredConfigs = [
      { key: 'jwt.secret', name: 'JWT_SECRET' },
      { key: 'database.url', name: 'DATABASE_URL' },
    ];
    const missing = requiredConfigs.filter(config => !this.configService.get(config.key));

    if (missing.length > 0) {
      throw new ConfigurationException(
        `Missing required configuration values: ${missing.map(c => c.name).join(', ')}`,
      );
    }
  }

  private async checkExternalDependencies(): Promise<void> {
    // Add checks for external services (Redis, S3, etc.) if used
    // For now, this is a placeholder that always passes
    await Promise.resolve();
  }

  private async checkMemoryUsage(): Promise<void> {
    const memUsage = process.memoryUsage();
    const maxHeapSize = memUsage.heapTotal;
    const usedHeap = memUsage.heapUsed;
    const heapUsagePercent = (usedHeap / maxHeapSize) * 100;

    // Warn if memory usage is over 90%
    if (heapUsagePercent > 90) {
      throw new Error(`High memory usage: ${heapUsagePercent.toFixed(2)}%`);
    }
  }

  private async performHealthCheck(
    name: string,
    checkFn: () => Promise<void>,
  ): Promise<IHealthCheckDetail> {
    const startTime = performance.now();

    try {
      await checkFn();
      const duration = performance.now() - startTime;

      return {
        name,
        status: 'ok',
        duration,
      };
    } catch (error) {
      const duration = performance.now() - startTime;

      return {
        name,
        status: 'error',
        message: error.message,
        duration,
      };
    }
  }

  private getApplicationVersion(): string {
    return this.configService.get<string>('appVersion', '?.?.?');
  }
}
