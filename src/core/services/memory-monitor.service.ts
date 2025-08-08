import { Injectable, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LOGGER_SERVICE } from '@shared/constants/tokens';
import { ILogger } from '@core/interfaces/logger.interface';
import { Mutex } from 'async-mutex';

/**
 * Memory monitoring service for application stability
 *
 * **Purpose**: Proactive memory management to prevent OOM crashes
 * and maintain application performance under high load.
 *
 * **Key Features**:
 * - Real-time heap memory monitoring
 * - Configurable warning and critical thresholds
 * - Automatic garbage collection triggers
 * - Emergency memory cleanup procedures
 * - Memory usage statistics and alerts
 *
 * **Monitoring Intervals**:
 * - Memory check every 30 seconds
 * - Emergency checks every 5 seconds when critical
 * - Immediate alerts on threshold breaches
 *
 * **Integration Points**:
 * - AuditLogQueueService for queue size management
 * - General application memory pressure
 * - Database connection pool sizing
 */
@Injectable()
export class MemoryMonitorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger: ILogger;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private emergencyInterval: NodeJS.Timeout | null = null;
  private isEmergencyMode = false;
  private secondaryGcTimeout: NodeJS.Timeout | null = null; // Track timeout for cleanup

  // Thread-safety primitives with atomic flags
  private readonly checkMutex = new Mutex();
  private readonly cleanupMutex = new Mutex();
  private isChecking = false;
  private mutexAcquired = false; // Atomic flag to prevent race conditions

  // Configuration
  private readonly monitoringEnabled: boolean;
  private readonly warningThreshold: number;
  private readonly criticalThreshold: number;
  private readonly maxOldSpaceSize: number;
  private readonly maxSemiSpaceSize: number;

  // Monitoring intervals
  private readonly NORMAL_CHECK_INTERVAL = 30000; // 30 seconds
  private readonly EMERGENCY_CHECK_INTERVAL = 5000; // 5 seconds
  private readonly GC_COOLDOWN = 10000; // 10 seconds between forced GC

  private lastGcTime = 0;

  constructor(
    private readonly configService: ConfigService,
    @Inject(LOGGER_SERVICE) logger: ILogger,
  ) {
    this.logger = logger;
    this.logger.setContext(MemoryMonitorService.name);

    // Load configuration with environment-specific defaults
    this.monitoringEnabled = this.configService.get<boolean>('monitoring.memoryMonitoringEnabled', false);

    // Environment-aware threshold configuration
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
    const environmentThresholds = this.getEnvironmentThresholds(nodeEnv);

    this.warningThreshold = this.configService.get<number>(
      'MEMORY_WARNING_THRESHOLD',
      environmentThresholds.warning,
    );
    this.criticalThreshold = this.configService.get<number>(
      'MEMORY_CRITICAL_THRESHOLD',
      environmentThresholds.critical,
    );
    this.maxOldSpaceSize = this.configService.get<number>(
      'NODE_MAX_OLD_SPACE_SIZE',
      environmentThresholds.maxHeap,
    );
    this.maxSemiSpaceSize = this.configService.get<number>(
      'NODE_MAX_SEMI_SPACE_SIZE',
      environmentThresholds.maxSemi,
    );
  }

  /**
   * Get environment-specific memory thresholds
   */
  private getEnvironmentThresholds(nodeEnv: string): {
    warning: number;
    critical: number;
    maxHeap: number;
    maxSemi: number;
  } {
    switch (nodeEnv) {
      case 'production':
        return {
          warning: 80, // More aggressive monitoring in production
          critical: 90, // Critical threshold remains high
          maxHeap: 4096, // 4GB heap for production
          maxSemi: 128, // 128MB semi-space
        };

      case 'test':
        return {
          warning: 60, // Lower thresholds for testing (limited resources)
          critical: 75, // Earlier critical detection in tests
          maxHeap: 1024, // 1GB heap for tests
          maxSemi: 32, // 32MB semi-space
        };

      case 'staging':
        return {
          warning: 75, // Balanced for staging environment
          critical: 85, // Moderate critical threshold
          maxHeap: 2048, // 2GB heap for staging
          maxSemi: 64, // 64MB semi-space
        };

      case 'development':
      default:
        return {
          warning: 70, // Lower threshold for development (frequent GC warnings help detect issues)
          critical: 85, // Still need protection from OOM
          maxHeap: 2048, // 2GB heap for development
          maxSemi: 64, // 64MB semi-space
        };
    }
  }

  onModuleInit() {
    if (this.monitoringEnabled) {
      // Check if memory options are actually applied
      const currentStats = this.getMemoryStats();

      this.startMonitoring();
      // Security: Sanitize Node.js environment information to prevent information disclosure
      const nodeOptionsInfo = this.sanitizeNodeOptions(process.env.NODE_OPTIONS);
      const sanitizedV8Stats = this.sanitizeV8Statistics(process.memoryUsage());

      this.logger.log({
        message: 'Memory monitoring started',
        configuredMaxHeapMB: this.maxOldSpaceSize,
        actualHeapMB: currentStats.heapTotalMB,
        warningThreshold: `${this.warningThreshold}%`,
        criticalThreshold: `${this.criticalThreshold}%`,
        nodeOptions: nodeOptionsInfo,
        v8HeapStatistics: sanitizedV8Stats,
      });
    } else {
      this.logger.log({
        message: 'Memory monitoring DISABLED by configuration',
        monitoringEnabled: this.monitoringEnabled,
      });
    }
  }

  onModuleDestroy() {
    this.stopMonitoring();
    // Clean up any pending secondary GC timeout
    if (this.secondaryGcTimeout) {
      clearTimeout(this.secondaryGcTimeout);
      this.secondaryGcTimeout = null;
    }
  }

  /**
   * Get current memory statistics
   */
  getMemoryStats(): {
    heapUsed: number;
    heapTotal: number;
    heapUsedMB: number;
    heapTotalMB: number;
    heapUsagePercent: number;
    heapUsagePercentOfMax: number;
    maxHeapMB: number;
    external: number;
    rss: number;
    isWarning: boolean;
    isCritical: boolean;
  } {
    const memUsage = process.memoryUsage();
    const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);

    // Calculate percentage based on current heap allocation
    const heapUsagePercent = Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100);

    // Calculate percentage based on configured maximum heap size
    const maxHeapBytes = this.maxOldSpaceSize * 1024 * 1024;
    const heapUsagePercentOfMax = Math.round((memUsage.heapUsed / maxHeapBytes) * 100);

    return {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      heapUsedMB,
      heapTotalMB,
      heapUsagePercent,
      heapUsagePercentOfMax,
      maxHeapMB: this.maxOldSpaceSize,
      external: memUsage.external,
      rss: memUsage.rss,
      // Use percentage of configured max for thresholds, not current heap
      isWarning: heapUsagePercentOfMax >= this.warningThreshold,
      isCritical: heapUsagePercentOfMax >= this.criticalThreshold,
    };
  }

  /**
   * Force garbage collection if available
   */
  forceGarbageCollection(): boolean {
    const now = Date.now();

    // Cooldown check to prevent excessive GC calls
    if (now - this.lastGcTime < this.GC_COOLDOWN) {
      return false;
    }

    if (global.gc) {
      try {
        // Schedule GC with proper delay to avoid blocking event loop
        setTimeout(() => {
          try {
            if (global.gc) global.gc();
            this.logger.log('Forced garbage collection executed');
          } catch (error) {
            this.logger.error('GC execution failed:', error);
          }
        }, 10); // Small delay to prevent blocking
        this.lastGcTime = now;

        return true;
      } catch (error) {
        this.logger.error({
          message: 'Failed to force garbage collection',
          error: error instanceof Error ? error.message : String(error),
        });

        return false;
      }
    } else {
      this.logger.warn('Garbage collection not available - start Node.js with --expose-gc flag');

      return false;
    }
  }

  /**
   * Start memory monitoring
   */
  private startMonitoring(): void {
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.checkMemoryUsage();
      } catch (error) {
        this.logger.error({
          message: 'Error in memory monitoring interval',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }, this.NORMAL_CHECK_INTERVAL);
  }

  /**
   * Sanitize Node.js options to prevent information disclosure
   */
  private sanitizeNodeOptions(nodeOptions?: string): string {
    if (!nodeOptions) {
      return 'Not configured';
    }

    // Security: Only expose safe memory-related options, hide potentially sensitive ones
    const safeOptions = [];
    const options = nodeOptions.split(' ').filter(opt => opt.trim());

    for (const option of options) {
      const trimmed = option.trim();
      if (trimmed.startsWith('--max-old-space-size=')) {
        safeOptions.push('--max-old-space-size=[CONFIGURED]');
      } else if (trimmed.startsWith('--max-semi-space-size=')) {
        safeOptions.push('--max-semi-space-size=[CONFIGURED]');
      } else if (trimmed === '--expose-gc') {
        safeOptions.push('--expose-gc');
      } else if (trimmed.startsWith('--')) {
        // Hide other potentially sensitive options
        safeOptions.push('[OPTION_HIDDEN]');
      }
    }

    return safeOptions.length > 0 ? safeOptions.join(' ') : 'No memory options configured';
  }

  /**
   * Sanitize V8 heap statistics to show only essential memory info
   */
  private sanitizeV8Statistics(memUsage: NodeJS.MemoryUsage): Record<string, string | number> {
    return {
      heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
      rssMB: Math.round(memUsage.rss / 1024 / 1024),
      // Hide external and arrayBuffers as they could reveal internal details
      externalMB: memUsage.external ? Math.round(memUsage.external / 1024 / 1024) : 'N/A',
      arrayBuffersMB: (memUsage as any).arrayBuffers
        ? Math.round((memUsage as any).arrayBuffers / 1024 / 1024)
        : 'N/A',
    };
  }

  /**
   * Stop memory monitoring
   */
  private stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    if (this.emergencyInterval) {
      clearInterval(this.emergencyInterval);
      this.emergencyInterval = null;
    }
  }

  /**
   * Start emergency monitoring (more frequent checks)
   */
  private startEmergencyMonitoring(): void {
    if (this.emergencyInterval) {
      return; // Already in emergency mode
    }

    this.isEmergencyMode = true;
    this.emergencyInterval = setInterval(async () => {
      try {
        await this.checkMemoryUsage(true);
      } catch (error) {
        this.logger.error({
          message: 'Error in emergency memory monitoring interval',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }, this.EMERGENCY_CHECK_INTERVAL);

    this.logger.warn('Emergency memory monitoring activated');
  }

  /**
   * Stop emergency monitoring
   */
  private stopEmergencyMonitoring(): void {
    if (this.emergencyInterval) {
      clearInterval(this.emergencyInterval);
      this.emergencyInterval = null;
      this.isEmergencyMode = false;
      this.logger.log('Emergency memory monitoring deactivated');
    }
  }

  /**
   * Check current memory usage and take action if needed (Thread-safe)
   */
  private async checkMemoryUsage(isEmergencyCheck = false): Promise<void> {
    // Atomic check to prevent race conditions
    if (this.isChecking || this.mutexAcquired) {
      return;
    }

    // Add timeout with proper cleanup
    const MUTEX_TIMEOUT = 1000; // 1 second
    let release: (() => void) | null = null;
    let timeoutId: NodeJS.Timeout | null = null;

    try {
      // Atomic flag to prevent multiple acquisitions
      this.mutexAcquired = true;

      const mutexPromise = this.checkMutex.acquire();
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error('Mutex timeout'));
        }, MUTEX_TIMEOUT);
      });

      release = await Promise.race([mutexPromise, timeoutPromise]);

      // Clear timeout if mutex acquired successfully
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    } catch (_error) {
      this.mutexAcquired = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      this.logger.warn('Memory check skipped due to mutex timeout');

      return;
    }

    try {
      if (this.isChecking) {
        return; // Double-check in case of race condition
      }

      this.isChecking = true;
      const stats = this.getMemoryStats();

      // Log current usage (debug level for normal checks, info for emergency)
      const memoryLogData = {
        message: 'Memory usage check',
        heapUsedMB: stats.heapUsedMB,
        heapTotalMB: stats.heapTotalMB,
        heapMaxMB: stats.maxHeapMB,
        heapUsagePercent: `${stats.heapUsagePercent}%`,
        heapUsageOfMaxPercent: `${stats.heapUsagePercentOfMax}%`,
        rss: Math.round(stats.rss / 1024 / 1024) + 'MB',
        isEmergencyMode: this.isEmergencyMode,
      };

      if (isEmergencyCheck) {
        this.logger.log(memoryLogData);
      } else {
        this.logger.debug(memoryLogData);
      }

      // Handle critical memory usage
      if (stats.isCritical) {
        await this.handleCriticalMemory(stats);

        if (!this.isEmergencyMode) {
          this.startEmergencyMonitoring();
        }
      }
      // Handle warning level memory usage
      else if (stats.isWarning) {
        await this.handleWarningMemory(stats);
      }
      // Memory is back to normal
      else if (this.isEmergencyMode) {
        this.stopEmergencyMonitoring();
        this.logger.log({
          message: 'Memory usage back to normal levels',
          heapUsageOfMaxPercent: `${stats.heapUsagePercentOfMax}%`,
          heapUsedMB: stats.heapUsedMB,
          maxHeapMB: stats.maxHeapMB,
        });
      }
    } catch (error) {
      this.logger.error({
        message: 'Error during memory usage check',
        isEmergencyCheck,
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.isChecking = false;
      this.mutexAcquired = false;
      if (release) {
        release();
      }
    }
  }

  /**
   * Handle warning level memory usage
   */
  private async handleWarningMemory(stats: ReturnType<typeof this.getMemoryStats>): Promise<void> {
    this.logger.warn({
      message: 'Memory usage warning threshold reached',
      heapUsageOfMaxPercent: `${stats.heapUsagePercentOfMax}%`,
      threshold: `${this.warningThreshold}%`,
      heapUsedMB: stats.heapUsedMB,
      maxHeapMB: stats.maxHeapMB,
      recommendation: 'Consider optimizing memory usage or increasing heap size',
    });

    // Trigger gentle garbage collection
    this.forceGarbageCollection();
  }

  /**
   * Handle critical memory usage
   */
  private async handleCriticalMemory(stats: ReturnType<typeof this.getMemoryStats>): Promise<void> {
    this.logger.error({
      message: 'CRITICAL: Memory usage critical threshold reached',
      heapUsageOfMaxPercent: `${stats.heapUsagePercentOfMax}%`,
      threshold: `${this.criticalThreshold}%`,
      heapUsedMB: stats.heapUsedMB,
      maxHeapMB: stats.maxHeapMB,
      actualHeapMB: stats.heapTotalMB,
      action: 'Initiating emergency memory cleanup',
    });

    // Emergency actions
    await this.emergencyMemoryCleanup();
  }

  /**
   * Emergency memory cleanup procedures (Thread-safe)
   */
  private async emergencyMemoryCleanup(): Promise<void> {
    // Use mutex with timeout to prevent deadlocks
    const MUTEX_TIMEOUT = 2000; // 2 seconds
    let release;
    try {
      release = await Promise.race([
        this.cleanupMutex.acquire(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Cleanup mutex timeout')), MUTEX_TIMEOUT),
        ),
      ]);
    } catch (_error) {
      this.logger.error('Emergency cleanup aborted due to mutex timeout');

      return;
    }

    try {
      this.logger.warn('Starting emergency memory cleanup');

      const beforeUsage = process.memoryUsage();

      // 1. Force garbage collection (safe operation)
      const gcSuccess = this.forceGarbageCollection();

      // 2. REMOVED: Cache clearing is too dangerous and can break the application
      // Instead, just force GC multiple times if needed
      if (global.gc && gcSuccess) {
        // Clear any existing timeout first
        if (this.secondaryGcTimeout) {
          clearTimeout(this.secondaryGcTimeout);
          this.secondaryGcTimeout = null;
        }

        // Multiple GC passes for thorough cleanup (with proper delay)
        this.secondaryGcTimeout = setTimeout(() => {
          try {
            if (global.gc) {
              // Execute in next tick to avoid blocking
              setImmediate(() => {
                try {
                  if (global.gc) global.gc();
                } catch (error) {
                  this.logger.warn('Secondary GC failed:', error);
                }
              });
            }
          } catch (error) {
            this.logger.warn({
              message: 'Secondary garbage collection setup failed',
              error: error instanceof Error ? error.message : String(error),
            });
          } finally {
            this.secondaryGcTimeout = null;
          }
        }, 200); // Increased delay for better spacing
      }

      // 3. Log emergency cleanup completion
      const postStats = this.getMemoryStats();
      this.logger.warn({
        message: 'Emergency memory cleanup completed',
        gcExecuted: gcSuccess,
        beforeMB: Math.round(beforeUsage.heapUsed / 1024 / 1024),
        afterMB: postStats.heapUsedMB,
        newUsageOfMaxPercent: `${postStats.heapUsagePercentOfMax}%`,
        actualHeapMB: postStats.heapTotalMB,
        maxHeapMB: postStats.maxHeapMB,
      });
    } catch (error) {
      this.logger.error({
        message: 'Error during emergency memory cleanup',
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      release();
    }
  }
}
