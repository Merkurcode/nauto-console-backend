import { Injectable, Inject, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Worker } from 'worker_threads';
import { join } from 'path';
import { ILogger } from '@core/interfaces/logger.interface';
import { LOGGER_SERVICE } from '@shared/constants/tokens';
import { ConfigService } from '@nestjs/config';

interface ISessionMetrics {
  totalSessions: number;
  activeSessions: number;
  expiredSessions: number;
  invalidSessions: number;
  averageSessionDuration: number;
  peakConcurrentSessions: number;
  memoryUsage: number;
  lastCleanup: number;
}

interface IWorkerMessage {
  type: 'metrics' | 'cleanup' | 'health' | 'error';
  data: any;
  timestamp: number;
}

/**
 * Worker Thread Session Monitor Service
 * 
 * Optimized for 1M+ concurrent users:
 * - Moves session monitoring to worker threads
 * - Non-blocking session cleanup and metrics
 * - Automatic memory management
 * - Circuit breaker for worker health
 * - Graceful worker restart on failures
 */
@Injectable()
export class WorkerSessionMonitorService implements OnModuleInit, OnModuleDestroy {
  private worker: Worker | null = null;
  private workerReady = false;
  private workerRestartCount = 0;
  private readonly MAX_WORKER_RESTARTS = 5;
  private readonly WORKER_TIMEOUT = 30000; // 30 seconds

  private metrics: ISessionMetrics = {
    totalSessions: 0,
    activeSessions: 0,
    expiredSessions: 0,
    invalidSessions: 0,
    averageSessionDuration: 0,
    peakConcurrentSessions: 0,
    memoryUsage: 0,
    lastCleanup: Date.now(),
  };

  private healthCheckInterval: NodeJS.Timeout | null = null;
  private metricsCallbacks: Array<(metrics: ISessionMetrics) => void> = [];

  constructor(
    private readonly configService: ConfigService,
    @Inject(LOGGER_SERVICE)
    private readonly logger: ILogger,
  ) {
    this.logger.setContext(WorkerSessionMonitorService.name);
  }

  async onModuleInit() {
    await this.startWorker();
    this.startHealthChecks();
    this.logger.log('Worker Session Monitor Service initialized');
  }

  async onModuleDestroy() {
    this.stopHealthChecks();
    await this.stopWorker();
  }

  /**
   * Start the worker thread for session monitoring
   */
  private async startWorker(): Promise<void> {
    try {
      const workerScript = join(__dirname, 'workers', 'session-monitor.worker.js');
      
      // Configuration for worker
      const config = {
        redisUrl: this.configService.get<string>('REDIS_URL'),
        sessionTTL: this.configService.get<number>('SESSION_TTL', 3600000), // 1 hour
        cleanupInterval: this.configService.get<number>('SESSION_CLEANUP_INTERVAL', 300000), // 5 minutes
        metricsInterval: this.configService.get<number>('SESSION_METRICS_INTERVAL', 60000), // 1 minute
        batchSize: this.configService.get<number>('SESSION_CLEANUP_BATCH_SIZE', 1000),
      };

      this.worker = new Worker(workerScript, {
        workerData: { config },
      });

      this.setupWorkerHandlers();
      
      // Wait for worker to be ready
      await this.waitForWorkerReady();
      
      this.logger.log('Session monitoring worker started successfully');
    } catch (error) {
      this.logger.error({
        message: 'Failed to start session monitoring worker',
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Stop the worker thread
   */
  private async stopWorker(): Promise<void> {
    if (!this.worker) return;

    try {
      // Send shutdown signal to worker
      this.worker.postMessage({
        type: 'shutdown',
        timestamp: Date.now(),
      });

      // Wait for graceful shutdown or force terminate
      const shutdownPromise = new Promise<void>((resolve) => {
        this.worker?.once('exit', () => resolve());
      });

      const timeoutPromise = new Promise<void>((resolve) => {
        setTimeout(() => {
          this.worker?.terminate();
          resolve();
        }, 5000); // 5 second timeout
      });

      await Promise.race([shutdownPromise, timeoutPromise]);
      this.worker = null;
      this.workerReady = false;
      
      this.logger.log('Session monitoring worker stopped');
    } catch (error) {
      this.logger.error({
        message: 'Error stopping session monitoring worker',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Setup worker message handlers
   */
  private setupWorkerHandlers(): void {
    if (!this.worker) return;

    this.worker.on('message', (message: IWorkerMessage) => {
      this.handleWorkerMessage(message);
    });

    this.worker.on('error', (error: Error) => {
      this.logger.error({
        message: 'Session monitoring worker error',
        error: error.message,
      });
      
      this.handleWorkerError(error);
    });

    this.worker.on('exit', (code: number) => {
      this.workerReady = false;
      
      if (code !== 0) {
        this.logger.error({
          message: 'Session monitoring worker exited with error',
          exitCode: code,
        });
        
        this.handleWorkerExit(code);
      } else {
        this.logger.log('Session monitoring worker exited cleanly');
      }
    });
  }

  /**
   * Handle messages from worker thread
   */
  private handleWorkerMessage(message: IWorkerMessage): void {
    switch (message.type) {
      case 'metrics':
        this.metrics = { ...this.metrics, ...message.data };
        this.notifyMetricsCallbacks(this.metrics);
        break;
        
      case 'cleanup':
        this.logger.debug({
          message: 'Session cleanup completed',
          cleanedSessions: message.data.cleaned,
          duration: message.data.duration,
        });
        break;
        
      case 'health':
        if (message.data.ready && !this.workerReady) {
          this.workerReady = true;
          this.logger.log('Session monitoring worker is ready');
        }
        break;
        
      case 'error':
        this.logger.error({
          message: 'Worker reported error',
          error: message.data.error,
          context: message.data.context,
        });
        break;
    }
  }

  /**
   * Handle worker errors
   */
  private handleWorkerError(error: Error): void {
    this.workerReady = false;
    
    if (this.workerRestartCount < this.MAX_WORKER_RESTARTS) {
      this.logger.warn(`Restarting worker (attempt ${this.workerRestartCount + 1}/${this.MAX_WORKER_RESTARTS})`);
      
      setTimeout(async () => {
        this.workerRestartCount++;
        await this.stopWorker();
        await this.startWorker();
      }, 5000 * this.workerRestartCount); // Exponential backoff
    } else {
      this.logger.error('Maximum worker restart attempts reached, disabling worker monitoring');
    }
  }

  /**
   * Handle worker exit
   */
  private handleWorkerExit(code: number): void {
    this.handleWorkerError(new Error(`Worker exited with code ${code}`));
  }

  /**
   * Wait for worker to be ready
   */
  private async waitForWorkerReady(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Worker startup timeout'));
      }, this.WORKER_TIMEOUT);

      const checkReady = () => {
        if (this.workerReady) {
          clearTimeout(timeout);
          resolve();
        } else {
          setTimeout(checkReady, 100);
        }
      };

      checkReady();
    });
  }

  /**
   * Get current session metrics
   */
  getMetrics(): ISessionMetrics {
    return { ...this.metrics };
  }

  /**
   * Subscribe to metrics updates
   */
  onMetricsUpdate(callback: (metrics: ISessionMetrics) => void): void {
    this.metricsCallbacks.push(callback);
  }

  /**
   * Unsubscribe from metrics updates
   */
  offMetricsUpdate(callback: (metrics: ISessionMetrics) => void): void {
    const index = this.metricsCallbacks.indexOf(callback);
    if (index > -1) {
      this.metricsCallbacks.splice(index, 1);
    }
  }

  /**
   * Notify all metrics callbacks
   */
  private notifyMetricsCallbacks(metrics: ISessionMetrics): void {
    for (const callback of this.metricsCallbacks) {
      try {
        callback(metrics);
      } catch (error) {
        this.logger.error({
          message: 'Error in metrics callback',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  /**
   * Manually trigger session cleanup
   */
  async triggerCleanup(): Promise<boolean> {
    if (!this.worker || !this.workerReady) {
      this.logger.warn('Worker not ready, cannot trigger cleanup');
      return false;
    }

    try {
      this.worker.postMessage({
        type: 'cleanup',
        timestamp: Date.now(),
      });
      
      return true;
    } catch (error) {
      this.logger.error({
        message: 'Failed to trigger session cleanup',
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Get worker health status
   */
  getWorkerHealth(): {
    ready: boolean;
    restartCount: number;
    uptime: number;
    lastMetricsUpdate: number;
  } {
    return {
      ready: this.workerReady,
      restartCount: this.workerRestartCount,
      uptime: this.worker ? Date.now() - (this.worker as any).threadId : 0,
      lastMetricsUpdate: this.metrics.lastCleanup,
    };
  }

  /**
   * Start health checks
   */
  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(() => {
      if (this.worker && this.workerReady) {
        try {
          this.worker.postMessage({
            type: 'health_check',
            timestamp: Date.now(),
          });
        } catch (error) {
          this.logger.error({
            message: 'Health check failed',
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }, 30000); // Health check every 30 seconds
  }

  /**
   * Stop health checks
   */
  private stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Restart worker manually
   */
  async restartWorker(): Promise<boolean> {
    try {
      await this.stopWorker();
      await this.startWorker();
      return true;
    } catch (error) {
      this.logger.error({
        message: 'Failed to restart worker',
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }
}