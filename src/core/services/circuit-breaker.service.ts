import { Injectable, Inject, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ErrorSanitizationUtil } from '@core/utils/error-sanitization.util';
import { LOGGER_SERVICE } from '@shared/constants/tokens';
import { ILogger } from '@core/interfaces/logger.interface';
import { Mutex } from 'async-mutex';

/**
 * Circuit breaker states
 */
enum CircuitState {
  CLOSED = 'CLOSED', // Normal operation
  OPEN = 'OPEN', // Circuit is open, failing fast
  HALF_OPEN = 'HALF_OPEN', // Testing if service is back
}

/**
 * Circuit breaker configuration
 */
interface ICircuitBreakerConfig {
  failureThreshold: number;
  timeout: number;
  resetTimeout: number;
  name: string;
  monitoringEnabled: boolean;
}

/**
 * Circuit breaker statistics
 */
interface ICircuitBreakerStats {
  name: string;
  state: CircuitState;
  failures: number;
  successes: number;
  rejections: number;
  lastFailureTime: Date | null;
  lastSuccessTime: Date | null;
  nextAttemptTime: Date | null;
}

/**
 * Circuit breaker implementation for external service resilience
 *
 * **Purpose**: Prevent cascading failures by temporarily stopping calls
 * to failing external services and allowing them time to recover.
 *
 * **Circuit States**:
 * - CLOSED: Normal operation, all requests pass through
 * - OPEN: Service is failing, all requests are rejected immediately
 * - HALF_OPEN: Testing phase, limited requests allowed to test recovery
 *
 * **Key Features**:
 * - Configurable failure thresholds
 * - Automatic recovery testing
 * - Fast-fail for better user experience
 * - Comprehensive statistics and monitoring
 * - Multiple circuit breakers per service type
 *
 * **Use Cases**:
 * - SMS service API calls
 * - Email service API calls
 * - Storage service (S3/MinIO) operations
 * - External authentication services
 * - Payment gateway integrations
 */
@Injectable()
export class CircuitBreakerService implements OnModuleInit, OnModuleDestroy {
  private readonly circuits = new Map<
    string,
    {
      config: ICircuitBreakerConfig;
      state: CircuitState;
      failures: number;
      successes: number;
      rejections: number;
      lastFailureTime: Date | null;
      lastSuccessTime: Date | null;
      nextAttemptTime: Date | null;
    }
  >();

  // Thread-safety: One mutex per circuit for fine-grained locking
  private readonly circuitMutexes = new Map<string, Mutex>();

  private readonly logger: ILogger;

  // Security: Thread-safe metrics collection with mutex protection
  private readonly globalMetrics = {
    totalRequests: 0,
    totalFailures: 0,
    totalRejections: 0,
    totalTimeouts: 0,
    circuitOpenings: 0,
    circuitClosings: 0,
    circuitsCleanedUp: 0,
    lastResetTime: new Date(),
  };

  // Security: Mutex for global metrics to prevent race conditions
  private readonly globalMetricsMutex = new Mutex();

  // Cleanup intervals
  private metricsCleanupInterval: NodeJS.Timeout | null = null;
  private circuitCleanupInterval: NodeJS.Timeout | null = null;
  private readonly METRICS_RESET_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
  private readonly CIRCUIT_CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour
  private readonly CIRCUIT_INACTIVITY_THRESHOLD = 24 * 60 * 60 * 1000; // 24 hours

  // Rate limiting for circuit creation (DoS protection)
  private readonly circuitCreationTracking = new Map<
    string,
    { count: number; resetTime: number }
  >();
  private readonly MAX_CIRCUITS_PER_IP_PER_HOUR = 10;
  private readonly MAX_RATE_LIMIT_ENTRIES = 1000; // Hard limit to prevent unbounded growth
  private readonly EMERGENCY_CLEANUP_THRESHOLD = 950; // Start aggressive cleanup early
  private readonly circuitCreationMutex = new Mutex();
  private cleanupInProgress = false; // Atomic flag to prevent concurrent cleanups

  // Default configuration
  private readonly defaultConfig: Omit<ICircuitBreakerConfig, 'name'>;

  constructor(
    private readonly configService: ConfigService,
    @Inject(LOGGER_SERVICE) logger: ILogger,
  ) {
    this.logger = logger;
    this.logger.setContext(CircuitBreakerService.name);

    // Load default configuration from environment
    this.defaultConfig = {
      failureThreshold: this.configService.get<number>('CIRCUIT_BREAKER_FAILURE_THRESHOLD', 5),
      timeout: this.configService.get<number>('CIRCUIT_BREAKER_TIMEOUT', 10000),
      resetTimeout: this.configService.get<number>('CIRCUIT_BREAKER_RESET_TIMEOUT', 60000),
      monitoringEnabled: this.configService.get<boolean>('CIRCUIT_BREAKER_MONITORING', true),
    };
  }

  // Security: Limit maximum circuits to prevent memory exhaustion attacks
  private static readonly MAX_CIRCUITS = 100;

  /**
   * Get or create a mutex for a specific circuit (Thread-safe with DoS protection)
   */
  private getCircuitMutex(serviceName: string): Mutex {
    // Security check: prevent unbounded Map growth
    if (
      this.circuitMutexes.size >= CircuitBreakerService.MAX_CIRCUITS &&
      !this.circuitMutexes.has(serviceName)
    ) {
      this.logger.error({
        message: 'Circuit breaker limit exceeded - potential DoS attack',
        currentCircuits: this.circuitMutexes.size,
        maxCircuits: CircuitBreakerService.MAX_CIRCUITS,
        rejectedService: serviceName,
      });
      throw new Error('Circuit breaker limit exceeded - service temporarily unavailable');
    }

    if (!this.circuitMutexes.has(serviceName)) {
      this.circuitMutexes.set(serviceName, new Mutex());
    }

    return this.circuitMutexes.get(serviceName)!;
  }

  /**
   * Create or get a circuit breaker for a specific service (with DoS protection)
   */
  getCircuit(
    serviceName: string,
    config?: Partial<ICircuitBreakerConfig>,
    clientIdentifier?: string,
  ): string {
    // Rate limiting check for new circuit creation
    if (!this.circuits.has(serviceName) && clientIdentifier) {
      const rateLimitCheck = this.checkCircuitCreationRateLimit(clientIdentifier);
      if (!rateLimitCheck.allowed) {
        this.logger.warn({
          message: 'Circuit creation rate limit exceeded',
          clientIdentifier,
          reason: rateLimitCheck.reason,
        });
        throw new Error('Too many circuit creation requests - please try again later');
      }
    }

    // Security check: prevent unbounded Map growth
    if (
      this.circuits.size >= CircuitBreakerService.MAX_CIRCUITS &&
      !this.circuits.has(serviceName)
    ) {
      this.logger.error({
        message: 'Maximum circuits exceeded - potential DoS attack',
        currentCircuits: this.circuits.size,
        maxCircuits: CircuitBreakerService.MAX_CIRCUITS,
        rejectedService: serviceName,
      });
      throw new Error('Circuit breaker limit exceeded - service temporarily unavailable');
    }

    if (!this.circuits.has(serviceName)) {
      const circuitConfig: ICircuitBreakerConfig = {
        ...this.defaultConfig,
        ...config,
        name: serviceName,
      };

      this.circuits.set(serviceName, {
        config: circuitConfig,
        state: CircuitState.CLOSED,
        failures: 0,
        successes: 0,
        rejections: 0,
        lastFailureTime: null,
        lastSuccessTime: null,
        nextAttemptTime: null,
      });

      if (circuitConfig.monitoringEnabled) {
        this.logger.log({
          message: `Circuit breaker created for service: ${serviceName}`,
          failureThreshold: circuitConfig.failureThreshold,
          timeout: circuitConfig.timeout,
          resetTimeout: circuitConfig.resetTimeout,
          totalCircuits: this.circuits.size,
        });
      }
    }

    return serviceName;
  }

  /**
   * Execute a function with circuit breaker protection (Thread-safe)
   */
  async execute<T>(
    serviceName: string,
    operation: () => Promise<T>,
    config?: Partial<ICircuitBreakerConfig>,
    clientIdentifier?: string,
  ): Promise<T> {
    const circuitKey = this.getCircuit(serviceName, config, clientIdentifier);
    const circuit = this.circuits.get(circuitKey)!;
    const mutex = this.getCircuitMutex(serviceName);

    // Thread-safe check if circuit allows the request
    const canExecute = await mutex.runExclusive(() => {
      return this.canExecute(circuit);
    });

    if (!canExecute) {
      // Security: Thread-safe rejection count increment with global metrics protection
      await Promise.all([
        mutex.runExclusive(() => {
          circuit.rejections++;
        }),
        this.globalMetricsMutex.runExclusive(() => {
          this.globalMetrics.totalRejections++;
        }),
      ]);

      const error = new Error(`Circuit breaker is OPEN for service: ${serviceName}`);
      error.name = 'CircuitBreakerError';

      if (circuit.config.monitoringEnabled) {
        this.logger.warn({
          message: 'Circuit breaker rejected request',
          service: serviceName,
          state: circuit.state,
          rejections: circuit.rejections,
          nextAttemptTime: circuit.nextAttemptTime,
        });
      }

      throw error;
    }

    try {
      // Security: Thread-safe request tracking
      await this.globalMetricsMutex.runExclusive(() => {
        this.globalMetrics.totalRequests++;
      });

      // Execute the operation
      const result = await Promise.race([
        operation(),
        this.createTimeoutPromise<T>(circuit.config.timeout, serviceName),
      ]);

      // Thread-safe success recording
      await mutex.runExclusive(async () => {
        await this.recordSuccess(circuit);
      });

      return result;
    } catch (error) {
      // Security: Thread-safe failure recording with global metrics protection
      await Promise.all([
        mutex.runExclusive(async () => {
          await this.recordFailure(circuit, error);
        }),
        this.globalMetricsMutex.runExclusive(() => {
          // Check if it's a timeout error
          if (error instanceof Error && error.name === 'CircuitBreakerTimeoutError') {
            this.globalMetrics.totalTimeouts++;
          }
          this.globalMetrics.totalFailures++;
        }),
      ]);
      throw error;
    }
  }

  /**
   * Get statistics for a specific circuit breaker
   */
  getStats(serviceName: string): ICircuitBreakerStats | null {
    const circuit = this.circuits.get(serviceName);
    if (!circuit) {
      return null;
    }

    return {
      name: serviceName,
      state: circuit.state,
      failures: circuit.failures,
      successes: circuit.successes,
      rejections: circuit.rejections,
      lastFailureTime: circuit.lastFailureTime,
      lastSuccessTime: circuit.lastSuccessTime,
      nextAttemptTime: circuit.nextAttemptTime,
    };
  }

  /**
   * Get statistics for all circuit breakers
   */
  getAllStats(): ICircuitBreakerStats[] {
    return Array.from(this.circuits.keys()).map(serviceName => this.getStats(serviceName)!);
  }

  /**
   * Get global circuit breaker metrics for observability (thread-safe)
   */
  async getGlobalMetrics() {
    // Security: Thread-safe access to global metrics
    return await this.globalMetricsMutex.runExclusive(() => {
      const circuitStates = Array.from(this.circuits.values());

      return {
        ...this.globalMetrics,
        totalCircuits: this.circuits.size,
        activeCircuits: circuitStates.filter(c => c.state !== CircuitState.CLOSED).length,
        openCircuits: circuitStates.filter(c => c.state === CircuitState.OPEN).length,
        halfOpenCircuits: circuitStates.filter(c => c.state === CircuitState.HALF_OPEN).length,
        circuitsCleanedUp: this.globalMetrics.circuitsCleanedUp,
        successRate:
          this.globalMetrics.totalRequests > 0
            ? Math.round(
                ((this.globalMetrics.totalRequests - this.globalMetrics.totalFailures) /
                  this.globalMetrics.totalRequests) *
                  100,
              )
            : 100,
        uptime: Math.round((Date.now() - this.globalMetrics.lastResetTime.getTime()) / 1000), // seconds
      };
    });
  }

  onModuleInit() {
    // Start periodic metrics cleanup to prevent memory leaks
    this.metricsCleanupInterval = setInterval(() => {
      this.resetMetrics();
    }, this.METRICS_RESET_INTERVAL);

    // Start periodic circuit cleanup to prevent memory leaks from inactive circuits
    this.circuitCleanupInterval = setInterval(() => {
      this.cleanupInactiveCircuits();
    }, this.CIRCUIT_CLEANUP_INTERVAL);

    // Clean up rate limiting tracking periodically
    setInterval(
      () => {
        this.cleanupRateLimitTracking();
      },
      60 * 60 * 1000,
    ); // Every hour

    this.logger.log({
      message: 'Circuit breaker service initialized',
      metricsResetInterval: `${this.METRICS_RESET_INTERVAL / 1000 / 60 / 60}h`,
      circuitCleanupInterval: `${this.CIRCUIT_CLEANUP_INTERVAL / 1000 / 60}m`,
      inactivityThreshold: `${this.CIRCUIT_INACTIVITY_THRESHOLD / 1000 / 60 / 60}h`,
    });
  }

  onModuleDestroy() {
    if (this.metricsCleanupInterval) {
      clearInterval(this.metricsCleanupInterval);
      this.metricsCleanupInterval = null;
    }
    if (this.circuitCleanupInterval) {
      clearInterval(this.circuitCleanupInterval);
      this.circuitCleanupInterval = null;
    }
    this.logger.log('Circuit breaker service destroyed');
  }

  /**
   * Reset global metrics to prevent memory leaks in long-running applications (thread-safe)
   */
  async resetMetrics(): Promise<void> {
    // Security: Thread-safe metrics reset
    await this.globalMetricsMutex.runExclusive(() => {
      const oldMetrics = { ...this.globalMetrics };

      this.globalMetrics.totalRequests = 0;
      this.globalMetrics.totalFailures = 0;
      this.globalMetrics.totalRejections = 0;
      this.globalMetrics.totalTimeouts = 0;
      this.globalMetrics.circuitOpenings = 0;
      this.globalMetrics.circuitClosings = 0;
      this.globalMetrics.lastResetTime = new Date();

      this.logger.log({
        message: 'Circuit breaker global metrics reset',
        previousMetrics: oldMetrics,
        resetTime: this.globalMetrics.lastResetTime,
      });
    });
  }

  /**
   * Manually reset a circuit breaker (for testing or emergency) (Deadlock-safe)
   */
  async reset(serviceName: string): Promise<boolean> {
    const circuit = this.circuits.get(serviceName);
    if (!circuit) {
      return false;
    }

    try {
      const mutex = this.getCircuitMutex(serviceName);

      // Security: Use try-acquire with timeout to prevent deadlocks
      const RESET_TIMEOUT = 5000; // 5 seconds

      const resetWithTimeout = Promise.race([
        mutex.runExclusive(() => {
          // Atomic reset operation
          circuit.state = CircuitState.CLOSED;
          circuit.failures = 0;
          circuit.successes = 0;
          circuit.rejections = 0;
          circuit.lastFailureTime = null;
          circuit.lastSuccessTime = null;
          circuit.nextAttemptTime = null;

          if (circuit.config.monitoringEnabled) {
            this.logger.log({
              message: 'Circuit breaker manually reset',
              service: serviceName,
              newState: circuit.state,
            });
          }

          return true;
        }),
        new Promise<boolean>((_, reject) =>
          setTimeout(
            () => reject(new Error('Reset operation timeout - potential deadlock detected')),
            RESET_TIMEOUT,
          ),
        ),
      ]);

      const result = await resetWithTimeout;

      return result;
    } catch (error) {
      const sanitizedError = ErrorSanitizationUtil.forLogging(error, 'circuit-reset');
      this.logger.error({
        message: 'Circuit breaker reset failed',
        service: serviceName,
        error: sanitizedError.message,
        isTimeout: error instanceof Error && error.message.includes('timeout'),
      });

      return false;
    }
  }

  /**
   * Synchronous reset fallback (for backward compatibility, but discouraged)
   */
  resetSync(serviceName: string): boolean {
    const circuit = this.circuits.get(serviceName);
    if (!circuit) {
      return false;
    }

    try {
      // Only attempt if mutex is not locked to avoid deadlocks
      const mutex = this.getCircuitMutex(serviceName);
      if (mutex.isLocked()) {
        this.logger.warn({
          message: 'Circuit breaker reset skipped - mutex locked (potential deadlock averted)',
          service: serviceName,
        });

        return false;
      }

      // Immediate reset without waiting for mutex (less safe but non-blocking)
      circuit.state = CircuitState.CLOSED;
      circuit.failures = 0;
      circuit.successes = 0;
      circuit.rejections = 0;
      circuit.lastFailureTime = null;
      circuit.lastSuccessTime = null;
      circuit.nextAttemptTime = null;

      if (circuit.config.monitoringEnabled) {
        this.logger.log(`Circuit breaker force reset (sync) for service: ${serviceName}`);
      }

      return true;
    } catch (error) {
      const sanitizedError = ErrorSanitizationUtil.forLogging(error, 'circuit-sync-reset');
      this.logger.error({
        message: 'Circuit breaker sync reset error',
        service: serviceName,
        error: sanitizedError.message,
      });

      return false;
    }
  }

  /**
   * Check if the circuit allows request execution
   */
  private canExecute(circuit: any): boolean {
    const now = new Date();

    switch (circuit.state) {
      case CircuitState.CLOSED:
        return true;

      case CircuitState.OPEN:
        // Check if it's time to try again (half-open)
        if (circuit.nextAttemptTime && now >= circuit.nextAttemptTime) {
          circuit.state = CircuitState.HALF_OPEN;
          if (circuit.config.monitoringEnabled) {
            this.logger.log(`Circuit breaker entering HALF_OPEN state: ${circuit.config.name}`);
          }

          return true;
        }

        return false;

      case CircuitState.HALF_OPEN:
        return true;

      default:
        return false;
    }
  }

  /**
   * Record a successful operation
   */
  private async recordSuccess(circuit: any): Promise<void> {
    circuit.successes++;
    circuit.lastSuccessTime = new Date();

    if (circuit.state === CircuitState.HALF_OPEN) {
      // Service appears to be recovered, close the circuit
      circuit.state = CircuitState.CLOSED;
      circuit.failures = 0; // Reset failure counter

      // Security: Thread-safe global metrics update - await to ensure order
      try {
        await this.globalMetricsMutex.runExclusive(() => {
          this.globalMetrics.circuitClosings++;
        });
      } catch (error) {
        this.logger.error({
          message: 'Failed to update global metrics for circuit closing',
          error: error instanceof Error ? error.message : String(error),
        });
      }

      if (circuit.config.monitoringEnabled) {
        this.logger.log({
          message: `Circuit breaker recovered and closed: ${circuit.config.name}`,
          totalSuccesses: circuit.successes,
        });
      }
    }
  }

  /**
   * Record a failed operation
   */
  private async recordFailure(circuit: any, error: any): Promise<void> {
    circuit.failures++;
    circuit.lastFailureTime = new Date();

    if (circuit.config.monitoringEnabled) {
      const sanitizedError = ErrorSanitizationUtil.forLogging(error, 'circuit-failure');
      this.logger.warn({
        message: `Circuit breaker recorded failure: ${circuit.config.name}`,
        error: sanitizedError.message,
        failures: circuit.failures,
        threshold: circuit.config.failureThreshold,
      });
    }

    // Check if we should open the circuit
    if (circuit.failures >= circuit.config.failureThreshold) {
      circuit.state = CircuitState.OPEN;
      circuit.nextAttemptTime = new Date(Date.now() + circuit.config.resetTimeout);

      // Security: Thread-safe global metrics update - await to ensure order
      try {
        await this.globalMetricsMutex.runExclusive(() => {
          this.globalMetrics.circuitOpenings++;
        });
      } catch (error) {
        this.logger.error({
          message: 'Failed to update global metrics for circuit opening',
          error: error instanceof Error ? error.message : String(error),
        });
      }

      if (circuit.config.monitoringEnabled) {
        this.logger.error({
          message: `Circuit breaker OPENED for service: ${circuit.config.name}`,
          failures: circuit.failures,
          threshold: circuit.config.failureThreshold,
          nextAttemptTime: circuit.nextAttemptTime,
        });
      }
    }
  }

  /**
   * Create a timeout promise for operations
   */
  private createTimeoutPromise<T>(timeout: number, serviceName: string): Promise<T> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        const error = new Error(`Operation timeout for service: ${serviceName} (${timeout}ms)`);
        error.name = 'CircuitBreakerTimeoutError';
        reject(error);
      }, timeout);
    });
  }

  /**
   * Clean up inactive circuits to prevent memory leaks (Thread-safe)
   */
  private async cleanupInactiveCircuits(): Promise<void> {
    try {
      const now = Date.now();
      const circuitsToRemove: string[] = [];

      // Identify inactive circuits
      for (const [name, circuit] of this.circuits.entries()) {
        const lastActivityTime = Math.max(
          circuit.lastFailureTime?.getTime() || 0,
          circuit.lastSuccessTime?.getTime() || 0,
        );

        // If circuit has been inactive for threshold period and is in CLOSED state
        if (
          now - lastActivityTime > this.CIRCUIT_INACTIVITY_THRESHOLD &&
          circuit.state === CircuitState.CLOSED
        ) {
          circuitsToRemove.push(name);
        }
      }

      // Remove inactive circuits (thread-safe)
      let cleanedCount = 0;
      for (const name of circuitsToRemove) {
        try {
          const mutex = this.circuitMutexes.get(name);

          // Only clean up if mutex is not locked (circuit not in use)
          if (mutex && !mutex.isLocked()) {
            this.circuits.delete(name);
            this.circuitMutexes.delete(name);
            cleanedCount++;
          }
        } catch (error) {
          this.logger.warn({
            message: 'Error cleaning up circuit',
            circuit: name,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      // Update metrics if circuits were cleaned
      if (cleanedCount > 0) {
        await this.globalMetricsMutex.runExclusive(() => {
          this.globalMetrics.circuitsCleanedUp += cleanedCount;
        });

        this.logger.log({
          message: 'Inactive circuits cleaned up',
          cleanedCount,
          totalCircuits: this.circuits.size,
          inactivityThreshold: `${this.CIRCUIT_INACTIVITY_THRESHOLD / 1000 / 60 / 60}h`,
        });
      }
    } catch (error) {
      this.logger.error({
        message: 'Error during circuit cleanup',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Check rate limit for circuit creation (DoS protection)
   */
  private checkCircuitCreationRateLimit(clientIdentifier: string): {
    allowed: boolean;
    reason?: string;
  } {
    const now = Date.now();
    const hourInMs = 60 * 60 * 1000;

    // Enhanced protection against unbounded Map growth
    if (this.circuitCreationTracking.size >= this.EMERGENCY_CLEANUP_THRESHOLD) {
      // Atomic cleanup to prevent race conditions
      if (!this.cleanupInProgress) {
        this.cleanupInProgress = true;
        try {
          this.cleanupRateLimitTracking();
        } finally {
          this.cleanupInProgress = false;
        }
      }
    }

    // Hard limit enforcement after cleanup
    if (
      this.circuitCreationTracking.size >= this.MAX_RATE_LIMIT_ENTRIES &&
      !this.circuitCreationTracking.has(clientIdentifier)
    ) {
      return {
        allowed: false,
        reason: 'Rate limiting at capacity - service temporarily unavailable',
      };
    }

    // Get or create tracking entry
    let tracking = this.circuitCreationTracking.get(clientIdentifier);

    if (!tracking || now > tracking.resetTime) {
      // Reset tracking for this client
      tracking = {
        count: 0,
        resetTime: now + hourInMs,
      };
      this.circuitCreationTracking.set(clientIdentifier, tracking);
    }

    // Check if limit exceeded
    if (tracking.count >= this.MAX_CIRCUITS_PER_IP_PER_HOUR) {
      return {
        allowed: false,
        reason: `Exceeded limit of ${this.MAX_CIRCUITS_PER_IP_PER_HOUR} circuits per hour`,
      };
    }

    // Increment count
    tracking.count++;

    return { allowed: true };
  }

  /**
   * Clean up old rate limit tracking entries to prevent memory leaks (race-condition safe)
   */
  private cleanupRateLimitTracking(): void {
    // Prevent concurrent cleanups
    if (this.cleanupInProgress) {
      return;
    }

    try {
      const now = Date.now();
      let removedCount = 0;
      const entriesToRemove: string[] = [];

      // First pass: identify entries to remove (atomic read)
      for (const [clientId, tracking] of this.circuitCreationTracking.entries()) {
        if (now > tracking.resetTime) {
          entriesToRemove.push(clientId);
        }
      }

      // Second pass: atomic removal
      for (const clientId of entriesToRemove) {
        if (this.circuitCreationTracking.delete(clientId)) {
          removedCount++;
        }
      }

      // If still over threshold, remove oldest entries aggressively
      if (this.circuitCreationTracking.size >= this.EMERGENCY_CLEANUP_THRESHOLD) {
        const entries = Array.from(this.circuitCreationTracking.entries()).sort(
          (a, b) => a[1].resetTime - b[1].resetTime,
        );

        const excessCount =
          this.circuitCreationTracking.size - Math.floor(this.EMERGENCY_CLEANUP_THRESHOLD / 2);
        for (let i = 0; i < excessCount && i < entries.length; i++) {
          if (this.circuitCreationTracking.delete(entries[i][0])) {
            removedCount++;
          }
        }
      }

      if (removedCount > 0) {
        this.logger.debug({
          message: 'Cleaned up rate limit tracking entries',
          removedCount,
          remainingEntries: this.circuitCreationTracking.size,
          wasEmergencyCleanup: removedCount > entriesToRemove.length,
        });
      }
    } catch (error) {
      this.logger.error({
        message: 'Error cleaning up rate limit tracking',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
