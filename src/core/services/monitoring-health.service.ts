import { Injectable, Inject, OnModuleInit, OnModuleDestroy, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LOGGER_SERVICE } from '@shared/constants/tokens';
import { ILogger } from '@core/interfaces/logger.interface';
import { MemoryMonitorService } from './memory-monitor.service';
import { CircuitBreakerService } from './circuit-breaker.service';
import { AuditLogQueueService } from './audit-log-queue.service';

/**
 * Health check status for monitoring services
 */
enum HealthStatus {
  HEALTHY = 'HEALTHY',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL',
  UNKNOWN = 'UNKNOWN',
}

/**
 * Health check result interface
 */
interface IHealthCheckResult {
  service: string;
  status: HealthStatus;
  message: string;
  details?: Record<string, any>;
  timestamp: Date;
  responseTimeMs?: number;
}

/**
 * System health summary
 */
interface ISystemHealthSummary {
  overallStatus: HealthStatus;
  healthyServices: number;
  warningServices: number;
  criticalServices: number;
  totalServices: number;
  lastCheckTime: Date;
  checks: IHealthCheckResult[];
}

/**
 * Comprehensive health monitoring for all monitoring services
 *
 * **Purpose**: Proactive detection of issues in monitoring infrastructure
 * to ensure the stability systems themselves are working correctly.
 *
 * **Key Features**:
 * - Health checks for all monitoring services
 * - Automatic issue detection and alerting
 * - Performance monitoring of monitoring systems
 * - Consolidated health status reporting
 * - Early warning system for infrastructure problems
 *
 * **Health Check Areas**:
 * - Memory monitoring service responsiveness
 * - Circuit breaker service state consistency
 * - Audit log queue processing health
 * - Thread safety and mutex performance
 * - Configuration validation
 */
@Injectable()
export class MonitoringHealthService implements OnModuleInit, OnModuleDestroy {
  private readonly logger: ILogger;
  private healthCheckInterval: NodeJS.Timeout | null = null;

  // Configuration
  private readonly healthCheckEnabled: boolean;
  private readonly healthCheckIntervalMs: number;
  private readonly responseTimeThresholdMs: number;
  private activeTimeouts = new Set<NodeJS.Timeout>(); // Track active timeouts for cleanup

  constructor(
    private readonly configService: ConfigService,
    @Inject(LOGGER_SERVICE) logger: ILogger,
    @Optional() private readonly memoryMonitorService?: MemoryMonitorService,
    @Optional() private readonly circuitBreakerService?: CircuitBreakerService,
    @Optional() private readonly auditLogQueueService?: AuditLogQueueService,
  ) {
    this.logger = logger;
    this.logger.setContext(MonitoringHealthService.name);

    // Load configuration
    this.healthCheckEnabled = this.configService.get<boolean>('monitoring.healthMonitoringEnabled', false);
    this.healthCheckIntervalMs = this.configService.get<number>(
      'MONITORING_HEALTH_INTERVAL',
      60000,
    ); // 1 minute
    this.responseTimeThresholdMs = this.configService.get<number>(
      'MONITORING_HEALTH_RESPONSE_THRESHOLD',
      1000,
    ); // 1 second
  }

  onModuleInit() {
    if (this.healthCheckEnabled) {
      // Validate monitoring service startup sequence
      this.validateMonitoringServices();

      this.startHealthChecks();
      this.logger.log({
        message: 'Monitoring health service started',
        intervalMs: this.healthCheckIntervalMs,
        responseThresholdMs: this.responseTimeThresholdMs,
        availableServices: {
          memoryMonitor: !!this.memoryMonitorService,
          circuitBreaker: !!this.circuitBreakerService,
          auditLogQueue: !!this.auditLogQueueService,
        },
      });
    } else {
      this.logger.log({
        message: 'Health monitoring DISABLED by configuration',
        healthCheckEnabled: this.healthCheckEnabled,
      });
    }
  }

  /**
   * Validate that monitoring services are available and functioning
   */
  private validateMonitoringServices(): void {
    const validationResults = [];

    // Check Memory Monitor Service
    if (this.memoryMonitorService) {
      try {
        const stats = this.memoryMonitorService.getMemoryStats();
        if (stats && typeof stats.heapUsedMB === 'number') {
          validationResults.push({
            service: 'MemoryMonitor',
            status: 'OK',
            heap: stats.heapUsedMB,
          });
        } else {
          validationResults.push({
            service: 'MemoryMonitor',
            status: 'INVALID_RESPONSE',
            response: stats,
          });
        }
      } catch (error) {
        validationResults.push({
          service: 'MemoryMonitor',
          status: 'ERROR',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    } else {
      validationResults.push({ service: 'MemoryMonitor', status: 'NOT_AVAILABLE' });
    }

    // Check Circuit Breaker Service
    if (this.circuitBreakerService) {
      try {
        const stats = this.circuitBreakerService.getAllStats();
        validationResults.push({ service: 'CircuitBreaker', status: 'OK', circuits: stats.length });
      } catch (error) {
        validationResults.push({
          service: 'CircuitBreaker',
          status: 'ERROR',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    } else {
      validationResults.push({ service: 'CircuitBreaker', status: 'NOT_AVAILABLE' });
    }

    // Check Audit Log Queue Service
    if (this.auditLogQueueService) {
      try {
        const stats = this.auditLogQueueService.getQueueStats();
        if (stats && typeof stats.queueSize === 'number') {
          validationResults.push({
            service: 'AuditLogQueue',
            status: 'OK',
            queueSize: stats.queueSize,
          });
        } else {
          validationResults.push({
            service: 'AuditLogQueue',
            status: 'INVALID_RESPONSE',
            response: stats,
          });
        }
      } catch (error) {
        validationResults.push({
          service: 'AuditLogQueue',
          status: 'ERROR',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    } else {
      validationResults.push({ service: 'AuditLogQueue', status: 'NOT_AVAILABLE' });
    }

    // Log validation results
    const errors = validationResults.filter(r => r.status === 'ERROR');
    const warnings = validationResults.filter(
      r => r.status === 'NOT_AVAILABLE' || r.status === 'INVALID_RESPONSE',
    );

    if (errors.length > 0) {
      this.logger.error({
        message: 'Monitoring service validation found critical errors',
        errors,
        allResults: validationResults,
      });
    } else if (warnings.length > 0) {
      this.logger.warn({
        message: 'Monitoring service validation found warnings',
        warnings,
        allResults: validationResults,
      });
    } else {
      this.logger.log({
        message: 'All monitoring services validated successfully',
        results: validationResults,
      });
    }
  }

  onModuleDestroy() {
    this.stopHealthChecks();

    // Clean up all active timeouts
    for (const timeoutId of this.activeTimeouts) {
      clearTimeout(timeoutId);
    }
    this.activeTimeouts.clear();

    this.logger.log('Monitoring health service destroyed');
  }

  /**
   * Get comprehensive system health status
   */
  async getSystemHealth(): Promise<ISystemHealthSummary> {
    const checks = await this.performAllHealthChecks();

    const healthyServices = checks.filter(c => c.status === HealthStatus.HEALTHY).length;
    const warningServices = checks.filter(c => c.status === HealthStatus.WARNING).length;
    const criticalServices = checks.filter(c => c.status === HealthStatus.CRITICAL).length;

    let overallStatus = HealthStatus.HEALTHY;
    if (criticalServices > 0) {
      overallStatus = HealthStatus.CRITICAL;
    } else if (warningServices > 0) {
      overallStatus = HealthStatus.WARNING;
    }

    return {
      overallStatus,
      healthyServices,
      warningServices,
      criticalServices,
      totalServices: checks.length,
      lastCheckTime: new Date(),
      checks,
    };
  }

  /**
   * Perform health checks for all monitoring services (with timeout protection)
   */
  private async performAllHealthChecks(): Promise<IHealthCheckResult[]> {
    const checks: Promise<IHealthCheckResult>[] = [
      this.checkSystemResourceHealth(), // Always available
    ];

    // Only check services that are available
    if (this.memoryMonitorService) {
      checks.push(this.checkMemoryMonitorHealth());
    }
    if (this.circuitBreakerService) {
      checks.push(this.checkCircuitBreakerHealth());
    }
    if (this.auditLogQueueService) {
      checks.push(this.checkAuditLogQueueHealth());
    }

    try {
      // Add timeout protection with proper cleanup
      const healthCheckTimeout = this.configService.get<number>('MONITORING_HEALTH_TIMEOUT', 5000); // 5 seconds

      let timeoutId: NodeJS.Timeout | null = null;
      const timeoutPromise = new Promise<IHealthCheckResult[]>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error('Health check timeout'));
        }, healthCheckTimeout);
        // Track timeout for cleanup
        if (timeoutId) {
          this.activeTimeouts.add(timeoutId);
        }
      });

      try {
        const result = await Promise.race([Promise.all(checks), timeoutPromise]);

        return result;
      } finally {
        // Clean up timeout whether it fired or not
        if (timeoutId) {
          clearTimeout(timeoutId);
          this.activeTimeouts.delete(timeoutId);
        }
      }
    } catch (error) {
      this.logger.error({
        message: 'Error performing health checks',
        error: error instanceof Error ? error.message : String(error),
        isTimeout: error instanceof Error && error.message === 'Health check timeout',
      });

      return [
        {
          service: 'health-check-system',
          status: HealthStatus.CRITICAL,
          message:
            error instanceof Error && error.message === 'Health check timeout'
              ? 'Health check system timeout - checks taking too long'
              : 'Health check system failure',
          details: { error: error instanceof Error ? error.message : String(error) },
          timestamp: new Date(),
        },
      ];
    }
  }

  /**
   * Health check for memory monitoring service
   */
  private async checkMemoryMonitorHealth(): Promise<IHealthCheckResult> {
    const startTime = Date.now();
    const serviceName = 'memory-monitor';

    try {
      // Check if service is available
      if (!this.memoryMonitorService) {
        return {
          service: serviceName,
          status: HealthStatus.CRITICAL,
          message: 'Memory monitor service not available',
          timestamp: new Date(),
          responseTimeMs: Date.now() - startTime,
        };
      }

      // Test memory stats retrieval
      const memoryStats = this.memoryMonitorService.getMemoryStats();
      const responseTime = Date.now() - startTime;

      // Validate response structure
      if (!memoryStats || typeof memoryStats.heapUsedMB !== 'number') {
        return {
          service: serviceName,
          status: HealthStatus.CRITICAL,
          message: 'Memory monitor returning invalid data structure',
          details: { memoryStats },
          timestamp: new Date(),
          responseTimeMs: responseTime,
        };
      }

      // Check response time
      if (responseTime > this.responseTimeThresholdMs) {
        return {
          service: serviceName,
          status: HealthStatus.WARNING,
          message: `Memory monitor response time high: ${responseTime}ms`,
          details: { responseTimeMs: responseTime, threshold: this.responseTimeThresholdMs },
          timestamp: new Date(),
          responseTimeMs: responseTime,
        };
      }

      // Check for concerning memory levels
      if (memoryStats.isCritical) {
        return {
          service: serviceName,
          status: HealthStatus.CRITICAL,
          message: `Critical memory usage detected: ${memoryStats.heapUsagePercentOfMax}%`,
          details: {
            heapUsedMB: memoryStats.heapUsedMB,
            heapUsagePercent: memoryStats.heapUsagePercentOfMax,
            maxHeapMB: memoryStats.maxHeapMB,
          },
          timestamp: new Date(),
          responseTimeMs: responseTime,
        };
      }

      if (memoryStats.isWarning) {
        return {
          service: serviceName,
          status: HealthStatus.WARNING,
          message: `Warning memory usage: ${memoryStats.heapUsagePercentOfMax}%`,
          details: {
            heapUsedMB: memoryStats.heapUsedMB,
            heapUsagePercent: memoryStats.heapUsagePercentOfMax,
          },
          timestamp: new Date(),
          responseTimeMs: responseTime,
        };
      }

      return {
        service: serviceName,
        status: HealthStatus.HEALTHY,
        message: `Memory monitoring healthy - ${memoryStats.heapUsedMB}MB used (${memoryStats.heapUsagePercentOfMax}%)`,
        details: {
          heapUsedMB: memoryStats.heapUsedMB,
          heapUsagePercent: memoryStats.heapUsagePercentOfMax,
        },
        timestamp: new Date(),
        responseTimeMs: responseTime,
      };
    } catch (error) {
      return {
        service: serviceName,
        status: HealthStatus.CRITICAL,
        message: 'Memory monitor health check failed',
        details: { error: error instanceof Error ? error.message : String(error) },
        timestamp: new Date(),
        responseTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Health check for circuit breaker service
   */
  private async checkCircuitBreakerHealth(): Promise<IHealthCheckResult> {
    const startTime = Date.now();
    const serviceName = 'circuit-breaker';

    try {
      // Check if service is available
      if (!this.circuitBreakerService) {
        return {
          service: serviceName,
          status: HealthStatus.CRITICAL,
          message: 'Circuit breaker service not available',
          timestamp: new Date(),
          responseTimeMs: Date.now() - startTime,
        };
      }

      // Get all circuit breaker stats
      const allStats = this.circuitBreakerService.getAllStats();
      const responseTime = Date.now() - startTime;

      // Check response time
      if (responseTime > this.responseTimeThresholdMs) {
        return {
          service: serviceName,
          status: HealthStatus.WARNING,
          message: `Circuit breaker response time high: ${responseTime}ms`,
          details: { responseTimeMs: responseTime, circuitCount: allStats.length },
          timestamp: new Date(),
          responseTimeMs: responseTime,
        };
      }

      // Analyze circuit states
      const openCircuits = allStats.filter(c => c.state === 'OPEN');
      const halfOpenCircuits = allStats.filter(c => c.state === 'HALF_OPEN');
      const totalFailures = allStats.reduce((sum, c) => sum + c.failures, 0);
      const totalRejections = allStats.reduce((sum, c) => sum + c.rejections, 0);

      if (openCircuits.length > 0) {
        return {
          service: serviceName,
          status: HealthStatus.WARNING,
          message: `${openCircuits.length} circuit(s) in OPEN state`,
          details: {
            openCircuits: openCircuits.map(c => c.name),
            totalCircuits: allStats.length,
            totalFailures,
            totalRejections,
          },
          timestamp: new Date(),
          responseTimeMs: responseTime,
        };
      }

      if (totalRejections > 100) {
        return {
          service: serviceName,
          status: HealthStatus.WARNING,
          message: `High rejection count: ${totalRejections}`,
          details: {
            totalRejections,
            totalCircuits: allStats.length,
            halfOpenCircuits: halfOpenCircuits.length,
          },
          timestamp: new Date(),
          responseTimeMs: responseTime,
        };
      }

      return {
        service: serviceName,
        status: HealthStatus.HEALTHY,
        message: `Circuit breaker healthy - ${allStats.length} circuits monitored`,
        details: {
          totalCircuits: allStats.length,
          openCircuits: openCircuits.length,
          halfOpenCircuits: halfOpenCircuits.length,
          totalFailures,
        },
        timestamp: new Date(),
        responseTimeMs: responseTime,
      };
    } catch (error) {
      return {
        service: serviceName,
        status: HealthStatus.CRITICAL,
        message: 'Circuit breaker health check failed',
        details: { error: error instanceof Error ? error.message : String(error) },
        timestamp: new Date(),
        responseTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Health check for audit log queue service
   */
  private async checkAuditLogQueueHealth(): Promise<IHealthCheckResult> {
    const startTime = Date.now();
    const serviceName = 'audit-log-queue';

    try {
      // Check if service is available
      if (!this.auditLogQueueService) {
        return {
          service: serviceName,
          status: HealthStatus.CRITICAL,
          message: 'Audit log queue service not available',
          timestamp: new Date(),
          responseTimeMs: Date.now() - startTime,
        };
      }

      // Get queue stats
      const queueStats = this.auditLogQueueService.getQueueStats();
      const responseTime = Date.now() - startTime;

      // Validate response
      if (typeof queueStats.queueSize !== 'number') {
        return {
          service: serviceName,
          status: HealthStatus.CRITICAL,
          message: 'Audit log queue returning invalid stats',
          details: { queueStats },
          timestamp: new Date(),
          responseTimeMs: responseTime,
        };
      }

      // Check response time
      if (responseTime > this.responseTimeThresholdMs) {
        return {
          service: serviceName,
          status: HealthStatus.WARNING,
          message: `Audit log queue response time high: ${responseTime}ms`,
          details: { responseTimeMs: responseTime },
          timestamp: new Date(),
          responseTimeMs: responseTime,
        };
      }

      // Check queue size thresholds
      const queueSizePercent = (queueStats.queueSize / queueStats.maxQueueSize) * 100;

      if (queueSizePercent > 90) {
        return {
          service: serviceName,
          status: HealthStatus.CRITICAL,
          message: `Audit log queue near capacity: ${queueSizePercent.toFixed(1)}%`,
          details: {
            queueSize: queueStats.queueSize,
            maxQueueSize: queueStats.maxQueueSize,
            queueSizePercent: queueSizePercent.toFixed(1),
            isProcessing: queueStats.isProcessing,
          },
          timestamp: new Date(),
          responseTimeMs: responseTime,
        };
      }

      if (queueSizePercent > 75) {
        return {
          service: serviceName,
          status: HealthStatus.WARNING,
          message: `Audit log queue size high: ${queueSizePercent.toFixed(1)}%`,
          details: {
            queueSize: queueStats.queueSize,
            maxQueueSize: queueStats.maxQueueSize,
            queueSizePercent: queueSizePercent.toFixed(1),
            isProcessing: queueStats.isProcessing,
          },
          timestamp: new Date(),
          responseTimeMs: responseTime,
        };
      }

      return {
        service: serviceName,
        status: HealthStatus.HEALTHY,
        message: `Audit log queue healthy - ${queueStats.queueSize}/${queueStats.maxQueueSize} (${queueSizePercent.toFixed(1)}%)`,
        details: {
          queueSize: queueStats.queueSize,
          queueSizePercent: queueSizePercent.toFixed(1),
          isProcessing: queueStats.isProcessing,
        },
        timestamp: new Date(),
        responseTimeMs: responseTime,
      };
    } catch (error) {
      return {
        service: serviceName,
        status: HealthStatus.CRITICAL,
        message: 'Audit log queue health check failed',
        details: { error: error instanceof Error ? error.message : String(error) },
        timestamp: new Date(),
        responseTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Health check for system resources
   */
  private async checkSystemResourceHealth(): Promise<IHealthCheckResult> {
    const startTime = Date.now();
    const serviceName = 'system-resources';

    try {
      const memUsage = process.memoryUsage();
      const uptime = process.uptime();
      const responseTime = Date.now() - startTime;

      // Check for memory pressure at OS level
      const rssMB = Math.round(memUsage.rss / 1024 / 1024);
      const externalMB = Math.round(memUsage.external / 1024 / 1024);

      // Simple thresholds for system health
      if (rssMB > 8192) {
        // 8GB RSS
        return {
          service: serviceName,
          status: HealthStatus.CRITICAL,
          message: `Very high RSS memory usage: ${rssMB}MB`,
          details: { rssMB, externalMB, uptimeHours: (uptime / 3600).toFixed(1) },
          timestamp: new Date(),
          responseTimeMs: responseTime,
        };
      }

      if (rssMB > 4096) {
        // 4GB RSS
        return {
          service: serviceName,
          status: HealthStatus.WARNING,
          message: `High RSS memory usage: ${rssMB}MB`,
          details: { rssMB, externalMB, uptimeHours: (uptime / 3600).toFixed(1) },
          timestamp: new Date(),
          responseTimeMs: responseTime,
        };
      }

      return {
        service: serviceName,
        status: HealthStatus.HEALTHY,
        message: `System resources healthy - RSS: ${rssMB}MB, Uptime: ${(uptime / 3600).toFixed(1)}h`,
        details: {
          rssMB,
          externalMB,
          uptimeHours: (uptime / 3600).toFixed(1),
          heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
        },
        timestamp: new Date(),
        responseTimeMs: responseTime,
      };
    } catch (error) {
      return {
        service: serviceName,
        status: HealthStatus.CRITICAL,
        message: 'System resource health check failed',
        details: { error: error instanceof Error ? error.message : String(error) },
        timestamp: new Date(),
        responseTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Start periodic health checks
   */
  private startHealthChecks(): void {
    // Clear any existing interval to prevent memory leaks
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    // Track if check is in progress to prevent stacking
    let isCheckInProgress = false;

    this.healthCheckInterval = setInterval(async () => {
      // Skip if previous check is still running
      if (isCheckInProgress) {
        this.logger.warn('Health check skipped - previous check still running');

        return;
      }

      isCheckInProgress = true;
      try {
        const healthSummary = await this.getSystemHealth();

        // Log health status based on severity
        if (healthSummary.overallStatus === HealthStatus.CRITICAL) {
          this.logger.error({
            message: 'CRITICAL: Monitoring system health issues detected',
            overallStatus: healthSummary.overallStatus,
            criticalServices: healthSummary.criticalServices,
            warningServices: healthSummary.warningServices,
            totalServices: healthSummary.totalServices,
            criticalChecks: healthSummary.checks.filter(c => c.status === HealthStatus.CRITICAL),
          });
        } else if (healthSummary.overallStatus === HealthStatus.WARNING) {
          this.logger.warn({
            message: 'WARNING: Monitoring system health warnings',
            overallStatus: healthSummary.overallStatus,
            warningServices: healthSummary.warningServices,
            totalServices: healthSummary.totalServices,
            warningChecks: healthSummary.checks.filter(c => c.status === HealthStatus.WARNING),
          });
        } else {
          this.logger.debug({
            message: 'Monitoring system health check passed',
            overallStatus: healthSummary.overallStatus,
            healthyServices: healthSummary.healthyServices,
            totalServices: healthSummary.totalServices,
          });
        }
      } catch (error) {
        // Never let health check errors crash the application
        try {
          this.logger.error({
            message: 'CRITICAL: Health check system failure - monitoring may be compromised',
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            timestamp: new Date().toISOString(),
          });
        } catch (logError) {
          // If even logging fails, use console as last resort
          console.error('CRITICAL: Health check and logging system failure:', {
            originalError: error,
            logError: logError,
            timestamp: new Date().toISOString(),
          });
        }
      } finally {
        isCheckInProgress = false;
      }
    }, this.healthCheckIntervalMs);
  }

  /**
   * Stop periodic health checks (with error handling)
   */
  private stopHealthChecks(): void {
    try {
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
        this.healthCheckInterval = null;
        this.logger.log('Monitoring health checks stopped successfully');
      }
    } catch (error) {
      // If logging fails, use console as fallback
      try {
        this.logger.error({
          message: 'Error stopping health checks',
          error: error instanceof Error ? error.message : String(error),
        });
      } catch (logError) {
        console.error('Failed to stop health checks:', { error, logError });
      }
    }
  }
}
