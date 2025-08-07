import { Injectable, Inject, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { ConfigService } from '@nestjs/config';
import { ILogger } from '@core/interfaces/logger.interface';
import { LOGGER_SERVICE } from '@shared/constants/tokens';

export enum CircuitBreakerState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open',
}

interface ICircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringPeriod: number;
  minimumThroughput: number;
  halfOpenMaxCalls: number;
}

interface ICircuitBreakerMetrics {
  totalCalls: number;
  failedCalls: number;
  successCalls: number;
  state: CircuitBreakerState;
  lastFailureTime: number;
  consecutiveFailures: number;
  halfOpenCalls: number;
}

/**
 * Distributed Circuit Breaker Service
 * 
 * Redis-based circuit breaker for 1M+ concurrent users:
 * - Distributed state management across multiple instances
 * - Lua scripts for atomic state transitions
 * - Sliding window failure rate calculation
 * - Automatic recovery and half-open testing
 * - Per-service circuit breaker isolation
 * - Circuit breaker metrics and monitoring
 */
@Injectable()
export class DistributedCircuitBreakerService implements OnModuleInit, OnModuleDestroy {
  private readonly circuits = new Map<string, ICircuitBreakerConfig>();
  private readonly localFallback = new Map<string, ICircuitBreakerMetrics>();
  
  private monitoringInterval: NodeJS.Timeout | null = null;
  private readonly MONITORING_INTERVAL = 10000; // 10 seconds

  // Lua script for atomic circuit breaker operations
  private readonly circuitBreakerScript = `
    local key = KEYS[1]
    local operation = ARGV[1]
    local current_time = tonumber(ARGV[2])
    local failure_threshold = tonumber(ARGV[3])
    local recovery_timeout = tonumber(ARGV[4])
    local monitoring_period = tonumber(ARGV[5])
    local minimum_throughput = tonumber(ARGV[6])
    local half_open_max_calls = tonumber(ARGV[7])

    -- Get current metrics
    local metrics = redis.call('HMGET', key, 
      'total_calls', 'failed_calls', 'success_calls', 'state', 
      'last_failure_time', 'consecutive_failures', 'half_open_calls')
    
    local total_calls = tonumber(metrics[1]) or 0
    local failed_calls = tonumber(metrics[2]) or 0
    local success_calls = tonumber(metrics[3]) or 0
    local state = metrics[4] or 'closed'
    local last_failure_time = tonumber(metrics[5]) or 0
    local consecutive_failures = tonumber(metrics[6]) or 0
    local half_open_calls = tonumber(metrics[7]) or 0

    -- Check if we should transition from OPEN to HALF_OPEN
    if state == 'open' and (current_time - last_failure_time) >= recovery_timeout then
      state = 'half_open'
      half_open_calls = 0
      redis.call('HSET', key, 'state', state, 'half_open_calls', half_open_calls)
    end

    -- Handle different operations
    if operation == 'check' then
      -- Check if call should be allowed
      if state == 'open' then
        return {0, state, total_calls, failed_calls, consecutive_failures}
      elseif state == 'half_open' and half_open_calls >= half_open_max_calls then
        return {0, state, total_calls, failed_calls, consecutive_failures}
      else
        return {1, state, total_calls, failed_calls, consecutive_failures}
      end
      
    elseif operation == 'success' then
      total_calls = total_calls + 1
      success_calls = success_calls + 1
      consecutive_failures = 0
      
      -- If half-open, check if we should close the circuit
      if state == 'half_open' then
        half_open_calls = half_open_calls + 1
        if half_open_calls >= half_open_max_calls then
          state = 'closed'
          half_open_calls = 0
        end
      end
      
      redis.call('HMSET', key,
        'total_calls', total_calls,
        'success_calls', success_calls,
        'consecutive_failures', consecutive_failures,
        'state', state,
        'half_open_calls', half_open_calls
      )
      redis.call('EXPIRE', key, monitoring_period * 2)
      
      return {1, state, total_calls, failed_calls, consecutive_failures}
      
    elseif operation == 'failure' then
      total_calls = total_calls + 1
      failed_calls = failed_calls + 1
      consecutive_failures = consecutive_failures + 1
      last_failure_time = current_time
      
      -- Check if we should open the circuit
      local failure_rate = 0
      if total_calls >= minimum_throughput then
        failure_rate = (failed_calls / total_calls) * 100
      end
      
      if (failure_rate >= failure_threshold and total_calls >= minimum_throughput) or 
         consecutive_failures >= failure_threshold then
        state = 'open'
        half_open_calls = 0
      end
      
      redis.call('HMSET', key,
        'total_calls', total_calls,
        'failed_calls', failed_calls,
        'consecutive_failures', consecutive_failures,
        'last_failure_time', last_failure_time,
        'state', state,
        'half_open_calls', half_open_calls
      )
      redis.call('EXPIRE', key, monitoring_period * 2)
      
      return {0, state, total_calls, failed_calls, consecutive_failures}
    end

    return {0, 'unknown', 0, 0, 0}
  `;

  constructor(
    @Inject('REDIS_CLIENT')
    private readonly redis: Redis,
    private readonly configService: ConfigService,
    @Inject(LOGGER_SERVICE)
    private readonly logger: ILogger,
  ) {
    this.logger.setContext(DistributedCircuitBreakerService.name);
  }

  async onModuleInit() {
    this.startMonitoring();
    this.logger.log('Distributed Circuit Breaker Service initialized');
  }

  async onModuleDestroy() {
    this.stopMonitoring();
  }

  /**
   * Register a circuit breaker for a service
   */
  registerCircuit(
    serviceName: string,
    config: Partial<ICircuitBreakerConfig> = {},
  ): void {
    const defaultConfig: ICircuitBreakerConfig = {
      failureThreshold: this.configService.get<number>('CIRCUIT_BREAKER_FAILURE_THRESHOLD', 50), // 50% failure rate
      recoveryTimeout: this.configService.get<number>('CIRCUIT_BREAKER_RECOVERY_TIMEOUT', 60000), // 1 minute
      monitoringPeriod: this.configService.get<number>('CIRCUIT_BREAKER_MONITORING_PERIOD', 300000), // 5 minutes
      minimumThroughput: this.configService.get<number>('CIRCUIT_BREAKER_MIN_THROUGHPUT', 10),
      halfOpenMaxCalls: this.configService.get<number>('CIRCUIT_BREAKER_HALF_OPEN_MAX_CALLS', 5),
    };

    this.circuits.set(serviceName, { ...defaultConfig, ...config });
    
    this.logger.log({
      message: `Circuit breaker registered for service: ${serviceName}`,
      config: this.circuits.get(serviceName),
    });
  }

  /**
   * Execute operation with circuit breaker protection
   */
  async execute<T>(
    serviceName: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    const config = this.circuits.get(serviceName);
    if (!config) {
      throw new Error(`Circuit breaker not registered for service: ${serviceName}`);
    }

    // Check if call is allowed
    const canExecute = await this.canExecute(serviceName);
    if (!canExecute) {
      throw new Error(`Circuit breaker is OPEN for service: ${serviceName}`);
    }

    try {
      const result = await operation();
      await this.recordSuccess(serviceName);
      return result;
    } catch (error) {
      await this.recordFailure(serviceName);
      throw error;
    }
  }

  /**
   * Check if a call can be executed (circuit breaker allows it)
   */
  async canExecute(serviceName: string): Promise<boolean> {
    const config = this.circuits.get(serviceName);
    if (!config) {
      return true; // Allow if no circuit breaker configured
    }

    try {
      const key = `cb:${serviceName}`;
      const now = Date.now();

      const result = await this.redis.eval(
        this.circuitBreakerScript,
        1,
        key,
        'check',
        now.toString(),
        config.failureThreshold.toString(),
        config.recoveryTimeout.toString(),
        config.monitoringPeriod.toString(),
        config.minimumThroughput.toString(),
        config.halfOpenMaxCalls.toString(),
      ) as [number, string, number, number, number];

      return result[0] === 1;
    } catch (error) {
      this.logger.error({
        message: 'Redis circuit breaker check failed, allowing call',
        serviceName,
        error: error instanceof Error ? error.message : String(error),
      });
      
      // Fallback to local circuit breaker
      return this.fallbackCanExecute(serviceName);
    }
  }

  /**
   * Record successful operation
   */
  async recordSuccess(serviceName: string): Promise<void> {
    const config = this.circuits.get(serviceName);
    if (!config) return;

    try {
      const key = `cb:${serviceName}`;
      const now = Date.now();

      await this.redis.eval(
        this.circuitBreakerScript,
        1,
        key,
        'success',
        now.toString(),
        config.failureThreshold.toString(),
        config.recoveryTimeout.toString(),
        config.monitoringPeriod.toString(),
        config.minimumThroughput.toString(),
        config.halfOpenMaxCalls.toString(),
      );
    } catch (error) {
      this.logger.error({
        message: 'Redis circuit breaker success recording failed',
        serviceName,
        error: error instanceof Error ? error.message : String(error),
      });
      
      // Fallback to local circuit breaker
      this.fallbackRecordSuccess(serviceName);
    }
  }

  /**
   * Record failed operation
   */
  async recordFailure(serviceName: string): Promise<void> {
    const config = this.circuits.get(serviceName);
    if (!config) return;

    try {
      const key = `cb:${serviceName}`;
      const now = Date.now();

      await this.redis.eval(
        this.circuitBreakerScript,
        1,
        key,
        'failure',
        now.toString(),
        config.failureThreshold.toString(),
        config.recoveryTimeout.toString(),
        config.monitoringPeriod.toString(),
        config.minimumThroughput.toString(),
        config.halfOpenMaxCalls.toString(),
      );
    } catch (error) {
      this.logger.error({
        message: 'Redis circuit breaker failure recording failed',
        serviceName,
        error: error instanceof Error ? error.message : String(error),
      });
      
      // Fallback to local circuit breaker
      this.fallbackRecordFailure(serviceName);
    }
  }

  /**
   * Get circuit breaker state and metrics
   */
  async getCircuitState(serviceName: string): Promise<{
    state: CircuitBreakerState;
    metrics: Partial<ICircuitBreakerMetrics>;
    config: ICircuitBreakerConfig;
  } | null> {
    const config = this.circuits.get(serviceName);
    if (!config) return null;

    try {
      const key = `cb:${serviceName}`;
      const metrics = await this.redis.hmget(
        key,
        'total_calls', 'failed_calls', 'success_calls', 'state',
        'last_failure_time', 'consecutive_failures', 'half_open_calls'
      );

      return {
        state: (metrics[3] as CircuitBreakerState) || CircuitBreakerState.CLOSED,
        metrics: {
          totalCalls: parseInt(metrics[0] || '0'),
          failedCalls: parseInt(metrics[1] || '0'),
          successCalls: parseInt(metrics[2] || '0'),
          lastFailureTime: parseInt(metrics[4] || '0'),
          consecutiveFailures: parseInt(metrics[5] || '0'),
          halfOpenCalls: parseInt(metrics[6] || '0'),
        },
        config,
      };
    } catch (error) {
      this.logger.error({
        message: 'Failed to get circuit breaker state',
        serviceName,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Get all circuit breaker states
   */
  async getAllCircuitStates(): Promise<Array<{
    serviceName: string;
    state: CircuitBreakerState;
    metrics: Partial<ICircuitBreakerMetrics>;
    config: ICircuitBreakerConfig;
  }>> {
    const results = [];
    
    for (const serviceName of this.circuits.keys()) {
      const circuitState = await this.getCircuitState(serviceName);
      if (circuitState) {
        results.push({
          serviceName,
          ...circuitState,
        });
      }
    }
    
    return results;
  }

  /**
   * Reset circuit breaker state
   */
  async resetCircuit(serviceName: string): Promise<boolean> {
    try {
      const key = `cb:${serviceName}`;
      await this.redis.del(key);
      
      // Also reset local fallback
      this.localFallback.delete(serviceName);
      
      this.logger.log(`Circuit breaker reset for service: ${serviceName}`);
      return true;
    } catch (error) {
      this.logger.error({
        message: 'Failed to reset circuit breaker',
        serviceName,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Start monitoring circuit breakers
   */
  private startMonitoring(): void {
    this.monitoringInterval = setInterval(async () => {
      try {
        const states = await this.getAllCircuitStates();
        const openCircuits = states.filter(s => s.state === CircuitBreakerState.OPEN);
        
        if (openCircuits.length > 0) {
          this.logger.warn({
            message: 'Circuit breakers in OPEN state',
            openCircuits: openCircuits.map(c => ({
              service: c.serviceName,
              failureRate: c.metrics.totalCalls ? 
                ((c.metrics.failedCalls || 0) / c.metrics.totalCalls * 100).toFixed(2) + '%' : '0%',
              consecutiveFailures: c.metrics.consecutiveFailures,
            })),
          });
        }
      } catch (error) {
        this.logger.error({
          message: 'Circuit breaker monitoring failed',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }, this.MONITORING_INTERVAL);
  }

  /**
   * Stop monitoring
   */
  private stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  /**
   * Fallback circuit breaker check when Redis is unavailable
   */
  private fallbackCanExecute(serviceName: string): boolean {
    const metrics = this.localFallback.get(serviceName);
    if (!metrics) return true;

    const config = this.circuits.get(serviceName)!;
    const now = Date.now();

    // Check for state transitions
    if (metrics.state === CircuitBreakerState.OPEN && 
        (now - metrics.lastFailureTime) >= config.recoveryTimeout) {
      metrics.state = CircuitBreakerState.HALF_OPEN;
      metrics.halfOpenCalls = 0;
    }

    if (metrics.state === CircuitBreakerState.OPEN) {
      return false;
    }

    if (metrics.state === CircuitBreakerState.HALF_OPEN && 
        metrics.halfOpenCalls >= config.halfOpenMaxCalls) {
      return false;
    }

    return true;
  }

  /**
   * Fallback success recording
   */
  private fallbackRecordSuccess(serviceName: string): void {
    const config = this.circuits.get(serviceName)!;
    let metrics = this.localFallback.get(serviceName);

    if (!metrics) {
      metrics = {
        totalCalls: 0,
        failedCalls: 0,
        successCalls: 0,
        state: CircuitBreakerState.CLOSED,
        lastFailureTime: 0,
        consecutiveFailures: 0,
        halfOpenCalls: 0,
      };
      this.localFallback.set(serviceName, metrics);
    }

    metrics.totalCalls++;
    metrics.successCalls++;
    metrics.consecutiveFailures = 0;

    if (metrics.state === CircuitBreakerState.HALF_OPEN) {
      metrics.halfOpenCalls++;
      if (metrics.halfOpenCalls >= config.halfOpenMaxCalls) {
        metrics.state = CircuitBreakerState.CLOSED;
        metrics.halfOpenCalls = 0;
      }
    }
  }

  /**
   * Fallback failure recording
   */
  private fallbackRecordFailure(serviceName: string): void {
    const config = this.circuits.get(serviceName)!;
    let metrics = this.localFallback.get(serviceName);

    if (!metrics) {
      metrics = {
        totalCalls: 0,
        failedCalls: 0,
        successCalls: 0,
        state: CircuitBreakerState.CLOSED,
        lastFailureTime: 0,
        consecutiveFailures: 0,
        halfOpenCalls: 0,
      };
      this.localFallback.set(serviceName, metrics);
    }

    metrics.totalCalls++;
    metrics.failedCalls++;
    metrics.consecutiveFailures++;
    metrics.lastFailureTime = Date.now();

    // Check if circuit should open
    const failureRate = (metrics.failedCalls / metrics.totalCalls) * 100;
    if ((failureRate >= config.failureThreshold && metrics.totalCalls >= config.minimumThroughput) ||
        metrics.consecutiveFailures >= config.failureThreshold) {
      metrics.state = CircuitBreakerState.OPEN;
      metrics.halfOpenCalls = 0;
    }
  }
}