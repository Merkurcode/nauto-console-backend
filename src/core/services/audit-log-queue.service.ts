import { Injectable, OnModuleInit, OnModuleDestroy, Inject } from '@nestjs/common';
import {
  AuditLog,
  AuditLogLevel,
  AuditLogType,
  AuditLogAction,
  IAuditLogMetadata,
} from '@core/entities/audit-log.entity';
import { UserId } from '@core/value-objects/user-id.vo';
import { ErrorSanitizationUtil } from '@core/utils/error-sanitization.util';
import { BusinessConfigurationService } from './business-configuration.service';
import { IAuditLogRepository } from '@core/repositories/audit-log.repository.interface';
import { AUDIT_LOG_REPOSITORY, LOGGER_SERVICE } from '@shared/constants/tokens';
import { ILogger } from '@core/interfaces/logger.interface';
import { Mutex } from 'async-mutex';

/**
 * Interfaz para logs en cola de procesamiento
 *
 * **Propósito**: Estructura optimizada para mantener logs en memoria
 * durante el procesamiento asíncrono, minimizando overhead.
 */
interface IQueuedAuditLog {
  level: AuditLogLevel;
  type: AuditLogType;
  action: AuditLogAction;
  message: string;
  userId: UserId | null;
  metadata: IAuditLogMetadata;
  context: string;
  timestamp: Date;
}

/**
 * Servicio de cola de alta performance para audit logs
 *
 * **Propósito**: Servicio especializado en procesamiento asíncrono de audit logs
 * optimizado para manejar millones de requests con mínimo impacto en performance.
 *
 * **Arquitectura de performance**:
 * - **Queue en memoria**: Array optimizado para O(1) enqueue
 * - **Procesamiento por lotes**: Batches de 1000 logs para máxima eficiencia
 * - **Intervalo configurable**: Procesamiento cada 2 segundos por defecto
 * - **Gestión de memoria**: Límites de cola y emergency flush automático
 * - **Fallback graceful**: Nunca bloquea operaciones principales
 *
 * **Características clave**:
 * - **Non-blocking**: Enqueue es O(1) y no bloquea nunca
 * - **Resiliente**: Continúa funcionando ante errores de BD
 * - **Configurable**: Parámetros ajustables por environment
 * - **Monitoreable**: Estadísticas de cola y performance
 * - **Auto-cleanup**: Previene memory leaks automáticamente
 * - **Transacción-independiente**: Logs persisten fuera de transacciones
 *
 * **Políticas de seguridad**:
 * - Logs se guardan FUERA de contexto transaccional
 * - Sanitización automática de campos sensibles
 * - Truncado inteligente de payloads grandes
 * - Drop de logs antiguos bajo presión de memoria
 *
 * **Performance targets**:
 * - 50,000+ logs/segundo enqueue rate
 * - <1ms latencia para enqueue
 * - 1,000 logs procesados por lote
 * - Máximo 50,000 logs en memoria simultanea
 *
 * @example
 * ```typescript
 * // Uso típico (ultra-rápido)
 * this.queueService.enqueue('info', 'auth', 'login', 'User logged in', userId, metadata);
 *
 * // Verificar estadísticas
 * const stats = this.queueService.getQueueStats();
 * console.log(`Queue size: ${stats.queueSize}, Processing: ${stats.isProcessing}`);
 *
 * // Emergency flush
 * const processed = await this.queueService.forceFlush();
 * ```
 *
 * **Integración con sistema**:
 * - Usado por AuditLogService para eventos async
 * - Iniciado automáticamente en OnModuleInit
 * - Flush automático en OnModuleDestroy
 * - Configuración via BusinessConfigurationService
 */
@Injectable()
export class AuditLogQueueService implements OnModuleInit, OnModuleDestroy {
  private queue: IQueuedAuditLog[] = [];
  private processingInterval: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private droppedLogsCount = 0; // Track dropped logs for monitoring
  private emergencyFlushPromise: Promise<void> | null = null;
  private emergencyFlushId = 0; // Atomic counter for emergency flush tracking
  private readonly MAX_EMERGENCY_FLUSH_ID = Number.MAX_SAFE_INTEGER - 1000; // Safety margin // Atomic emergency flush control

  // Rate limiting for DoS protection (with memory leak protection)
  private readonly requestCounts = new Map<string, { count: number; resetTime: number }>();
  private readonly MAX_REQUESTS_PER_MINUTE = 1000; // Per user/IP
  private readonly RATE_LIMIT_WINDOW = 60000; // 1 minute
  private readonly MAX_RATE_LIMIT_ENTRIES = 10000; // Prevent unbounded growth
  private readonly CLEANUP_THRESHOLD = 8000; // Start cleanup at 80% capacity

  // Thread-safety primitives
  private readonly queueMutex = new Mutex();
  private readonly processingMutex = new Mutex();

  // Configuration for high performance
  private readonly BATCH_SIZE = 1000; // Process 1000 logs at once
  private readonly PROCESS_INTERVAL = 2000; // Process every 2 seconds
  private readonly MAX_QUEUE_SIZE = 50000; // Max logs in memory
  private readonly EMERGENCY_FLUSH_SIZE = 45000; // Emergency flush threshold

  constructor(
    private readonly businessConfigService: BusinessConfigurationService,
    @Inject(AUDIT_LOG_REPOSITORY)
    private readonly auditLogRepository: IAuditLogRepository,
    @Inject(LOGGER_SERVICE)
    private readonly logger: ILogger,
  ) {
    this.logger.setContext(AuditLogQueueService.name);
  }

  onModuleInit() {
    // Start background processing
    this.startProcessing();
  }

  async onModuleDestroy() {
    // Flush remaining logs before shutdown
    this.stopProcessing();

    // Thread-safe final flush
    const release = await this.queueMutex.acquire();
    try {
      if (this.queue.length > 0) {
        await this.processQueueBatch();
      }
    } finally {
      release();
    }
  }

  /**
   * Añade entrada de log a la cola (ultra-rápido, no-bloqueante)
   *
   * **Propósito**: Método principal ultra-optimizado para añadir logs
   * a la cola con latencia mínima (<1ms) y garantía de no-bloqueo.
   *
   * **Optimizaciones de performance**:
   * - Operación O(1) - array.push() directo
   * - Verificación instantánea de feature flags
   * - Emergency flush automático bajo presión
   * - Drop inteligente de logs antiguos (previene memory overflow)
   * - Optimización de metadata en tiempo real
   *
   * **Políticas de gestión**:
   * - Skip si audit logging está deshabilitado
   * - Emergency flush a 45,000 logs (90% capacidad)
   * - Drop oldest logs a 50,000 (100% capacidad)
   * - Optimización automática de metadata
   *
   * @param level - Nivel de severidad del log
   * @param type - Categoría del evento
   * @param action - Acción específica realizada
   * @param message - Mensaje descriptivo
   * @param userId - Usuario asociado (opcional)
   * @param metadata - Contexto adicional (será optimizado)
   * @param context - Contexto de aplicación
   */
  async enqueue(
    level: AuditLogLevel,
    type: AuditLogType,
    action: AuditLogAction,
    message: string,
    userId: UserId | null = null,
    metadata: IAuditLogMetadata = {},
    context: string = 'system',
  ): Promise<void> {
    // Skip if audit logging is disabled
    const featureFlags = this.businessConfigService.getFeatureFlags();
    if (!featureFlags.auditLoggingEnabled) {
      return;
    }

    // Input validation and sanitization
    if (!this.validateInput(level, type, action, message, metadata)) {
      return; // Reject invalid input silently to prevent log spam
    }

    // Rate limiting check
    if (!this.checkRateLimit(userId?.toString() || 'anonymous')) {
      return; // Reject if rate limit exceeded
    }

    // Thread-safe enqueue operation
    await this.queueMutex.runExclusive(() => {
      // Security: Atomic emergency flush with proper race condition prevention
      if (this.queue.length >= this.EMERGENCY_FLUSH_SIZE) {
        // Triple-check pattern with atomic counter
        if (!this.emergencyFlushPromise) {
          // Increment atomic counter with overflow protection
          if (this.emergencyFlushId >= this.MAX_EMERGENCY_FLUSH_ID) {
            this.emergencyFlushId = 1; // Reset to prevent overflow
          }
          const currentFlushId = ++this.emergencyFlushId;

          // Create promise with unique ID for atomic cleanup
          const flushPromise = this.emergencyFlush()
            .catch(error => {
              // Log error but don't propagate to prevent blocking enqueue
              const sanitizedError = ErrorSanitizationUtil.forLogging(error, 'emergency-flush');
              console.error(`Emergency flush ${currentFlushId} failed:`, sanitizedError.message);
            })
            .finally(() => {
              // Atomic cleanup - only reset if this flush ID is still active
              if (
                this.emergencyFlushPromise === flushPromise &&
                this.emergencyFlushId === currentFlushId
              ) {
                this.emergencyFlushPromise = null;
              }
            });

          // Final atomic assignment with double-check
          if (!this.emergencyFlushPromise) {
            this.emergencyFlushPromise = flushPromise;
          }
        }
      }

      // Drop oldest logs if queue is at max capacity (prevent memory overflow)
      if (this.queue.length >= this.MAX_QUEUE_SIZE) {
        // Drop in batches for better performance (shift() is O(n) on large arrays)
        const dropCount = Math.min(this.BATCH_SIZE, this.queue.length);
        this.queue.splice(0, dropCount);
        this.droppedLogsCount += dropCount;

        // Log critical overflow (but don't queue it to avoid recursion)
        console.warn(
          `CRITICAL: Audit log queue overflow - dropped ${dropCount} old logs. Queue: ${this.queue.length}/${this.MAX_QUEUE_SIZE}`,
        );
      }

      // Add to queue (O(1) operation)
      this.queue.push({
        level,
        type,
        action,
        message,
        userId,
        metadata: this.optimizeMetadata(metadata),
        context,
        timestamp: new Date(),
      });
    });
  }

  /**
   * Get queue statistics
   */
  getQueueStats(): {
    queueSize: number;
    isProcessing: boolean;
    maxQueueSize: number;
    batchSize: number;
    processInterval: number;
    droppedLogsCount: number;
    queueUtilization: number;
  } {
    // Thread-safe read of queue size
    const queueSize = this.queueMutex.isLocked() ? -1 : this.queue.length;

    return {
      queueSize,
      isProcessing: this.isProcessing,
      maxQueueSize: this.MAX_QUEUE_SIZE,
      batchSize: this.BATCH_SIZE,
      processInterval: this.PROCESS_INTERVAL,
      droppedLogsCount: this.droppedLogsCount,
      queueUtilization: Math.round((queueSize / this.MAX_QUEUE_SIZE) * 100), // Utilization percentage
    };
  }

  /**
   * Force flush queue (for testing or emergency)
   */
  async forceFlush(): Promise<number> {
    // Thread-safe force flush
    const release = await this.processingMutex.acquire();
    try {
      const processed = await this.processQueueBatch();

      return processed;
    } finally {
      release();
    }
  }

  /**
   * Start background processing
   */
  private startProcessing(): void {
    this.processingInterval = setInterval(async () => {
      // Thread-safe check and process
      if (this.processingMutex.isLocked()) {
        return; // Already processing
      }

      const hasWork = await this.queueMutex.runExclusive(() => this.queue.length > 0);
      if (hasWork) {
        this.processQueueBatch().catch(console.error);
      }
    }, this.PROCESS_INTERVAL);
  }

  /**
   * Stop background processing
   */
  private stopProcessing(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
  }

  /**
   * Emergency flush when queue is getting too large (atomic operation)
   */
  private async emergencyFlush(): Promise<void> {
    try {
      // Security: Check if processing is already happening to avoid conflicts
      if (this.processingMutex.isLocked()) {
        // Already processing, this emergency flush will be handled by regular processing
        return;
      }

      // Acquire processing mutex for exclusive access
      const release = await this.processingMutex.acquire();
      try {
        // Process multiple batches if queue is very large
        let processed = 0;
        const maxEmergencyProcessing = 5; // Max 5 batches per emergency flush

        for (let i = 0; i < maxEmergencyProcessing; i++) {
          const batchProcessed = await this.processQueueBatch();
          processed += batchProcessed;

          // Stop if queue is under control or no more logs to process
          if (batchProcessed === 0 || this.queue.length < this.EMERGENCY_FLUSH_SIZE) {
            break;
          }
        }

        if (processed > 0) {
          console.warn(
            `Emergency flush completed: processed ${processed} logs, queue size: ${this.queue.length}`,
          );
        }
      } finally {
        release();
      }
    } catch (error) {
      // Log error with sanitization - don't re-throw to prevent blocking enqueue
      const sanitizedError = ErrorSanitizationUtil.forLogging(error, 'emergency-flush-execution');
      console.error('Emergency flush error:', sanitizedError.message);
    }
  }

  /**
   * Process batch of logs (async, non-blocking)
   */
  private async processQueueBatch(): Promise<number> {
    // Thread-safe batch processing
    const release = await this.processingMutex.acquire();

    try {
      // Check if there's work to do
      const batch = await this.queueMutex.runExclusive(() => {
        if (this.queue.length === 0) {
          return [];
        }

        // Extract batch from queue atomically
        const batchSize = Math.min(this.BATCH_SIZE, this.queue.length);

        return this.queue.splice(0, batchSize);
      });

      if (batch.length === 0) {
        return 0;
      }

      this.isProcessing = true;
      let processed = 0;

      try {
        // Convert to domain entities
        const auditLogs = batch.map(item =>
          AuditLog.create(
            item.level,
            item.type,
            item.action,
            item.message,
            item.userId,
            item.metadata,
            item.context,
          ),
        );

        // Batch insert to database (will be handled by repository)
        await this.batchInsertLogs(auditLogs);
        processed = auditLogs.length;
      } catch (error) {
        const sanitizedError = ErrorSanitizationUtil.forLogging(error, 'batch-processing');
        console.error('Failed to process audit log batch:', sanitizedError.message);
        // In case of error, we could optionally re-add failed logs to queue
        // but for performance, we'll just log the error and continue
      } finally {
        this.isProcessing = false;
      }

      return processed;
    } finally {
      release();
    }
  }

  /**
   * Inserta logs en lotes a la base de datos
   *
   * **IMPORTANTE**: Los logs se guardan FUERA de cualquier contexto transaccional
   * para garantizar que se persistan incluso si la operación principal falla o rollback.
   *
   * **Arquitectura de persistencia**:
   * - Cada log se guarda independientemente
   * - Promise.allSettled para máxima resiliencia
   * - Logging de errores sin afectar procesamiento
   * - Nunca lanza excepciones hacia arriba
   *
   * **Políticas de error**:
   * - Fallos individuales no afectan el lote
   * - Logging detallado de errores para debugging
   * - Continuación de procesamiento ante fallos
   * - Máximo 3 errores reportados por lote
   *
   * @param auditLogs - Array de logs para persistir
   */
  private async batchInsertLogs(auditLogs: AuditLog[]): Promise<void> {
    try {
      // Save logs individually to ensure each log is saved independently
      // This ensures audit logs are saved even if the main transaction fails
      const promises = auditLogs.map(log => this.saveSingleLog(log));
      const results = await Promise.allSettled(promises);

      // Log any failures (with sanitized error messages)
      const failures = results.filter(r => r.status === 'rejected');
      if (failures.length > 0) {
        this.logger.warn({
          message: 'Some audit logs failed to save',
          failedCount: failures.length,
          totalCount: auditLogs.length,
          errors: failures.slice(0, 3).map((f: any) => {
            const error = f.reason;
            const sanitized = ErrorSanitizationUtil.forLogging(error, 'batch-insert');

            return sanitized.message;
          }),
        });
      }
    } catch (error) {
      // Never throw - audit logging should not affect main operation (with sanitization)
      const sanitizedError = ErrorSanitizationUtil.forLogging(error, 'critical-batch-insert');
      this.logger.error({
        message: 'Critical error in batch audit log insert',
        error: sanitizedError.message,
        logsCount: auditLogs.length,
      });
    }
  }

  /**
   * Save single audit log
   * IMPORTANT: This is executed OUTSIDE of any transaction to ensure
   * audit logs are always persisted regardless of transaction outcome
   */
  private async saveSingleLog(auditLog: AuditLog): Promise<void> {
    try {
      // Save without transaction context to ensure persistence
      await this.auditLogRepository.save(auditLog);

      // Log success for debugging (can be removed in production)
      this.logger.debug({
        message: 'Audit log saved successfully',
        auditLogId: auditLog.id.getValue(),
        type: auditLog.type,
        action: auditLog.action,
      });
    } catch (error) {
      // Log error but don't throw - audit failures should not affect main operation (with sanitization)
      const sanitizedError = ErrorSanitizationUtil.forLogging(error, 'single-log-save');
      this.logger.error({
        message: 'Failed to save individual audit log',
        error: sanitizedError.message,
        auditLogData: {
          id: auditLog.id.getValue(),
          level: auditLog.level,
          type: auditLog.type,
          action: auditLog.action,
          message: ErrorSanitizationUtil.sanitizeMessage(auditLog.message || 'No message'),
        },
      });
    }
  }

  /**
   * Optimize metadata to reduce memory usage (prototype pollution protected)
   */
  private optimizeMetadata(metadata: IAuditLogMetadata): IAuditLogMetadata {
    // Security: Create object without prototype to prevent pollution
    const optimized = Object.create(null);

    // Safely copy only safe properties to prevent prototype pollution
    if (metadata && typeof metadata === 'object' && metadata.constructor === Object) {
      const safeKeys = Object.keys(metadata).filter(key => {
        // Security: Reject dangerous keys that could cause prototype pollution
        return (
          key !== '__proto__' &&
          key !== 'constructor' &&
          key !== 'prototype' &&
          !key.startsWith('__') &&
          key.length < 100
        ); // Prevent excessively long keys
      });

      for (const key of safeKeys) {
        const value = metadata[key];

        // Security: Only copy safe primitive types and plain objects
        if (value === null || value === undefined) {
          // Skip null/undefined to save space
          continue;
        } else if (typeof value === 'string') {
          // Truncate large text fields
          if (key === 'errorStack' && value.length > 2000) {
            optimized[key] = value.substring(0, 2000) + '... [truncated]';
          } else if (value.length > 5000) {
            optimized[key] = '[Large text truncated]';
          } else {
            optimized[key] = value;
          }
        } else if (typeof value === 'number' && isFinite(value)) {
          optimized[key] = value;
        } else if (typeof value === 'boolean') {
          optimized[key] = value;
        } else if (Array.isArray(value)) {
          // Safely handle arrays with size limit
          optimized[key] = value.length > 100 ? '[Large array truncated]' : value.slice(0, 100);
        } else if (typeof value === 'object' && value.constructor === Object) {
          // Security: Deep sanitization to prevent prototype pollution
          try {
            const sanitizedObject = this.sanitizeObjectRecursive(value, 0);
            const sanitizedStr = JSON.stringify(sanitizedObject);

            if (sanitizedStr.length > 1000) {
              optimized[key] = { message: '[Large object truncated]' };
            } else {
              optimized[key] = sanitizedObject;
            }
          } catch {
            optimized[key] = '[Invalid object]';
          }
        }
        // Ignore functions, symbols, and other unsafe types
      }
    }

    return optimized;
  }

  /**
   * Recursively sanitize objects to prevent prototype pollution (comprehensive protection)
   */
  private sanitizeObjectRecursive(obj: any, depth: number, visited = new WeakSet()): any {
    // Security: Prevent deep recursion attacks - strict depth limit
    const MAX_DEPTH = 3; // Further reduced for security
    if (depth > MAX_DEPTH) {
      return '[Max depth exceeded]';
    }

    // Handle primitive values
    if (obj === null || obj === undefined) {
      return null;
    }

    if (typeof obj !== 'object') {
      // Additional validation for strings to prevent exploitation
      if (typeof obj === 'string' && obj.length > 1000) {
        return '[String too long]';
      }

      return obj;
    }

    // Prevent circular reference infinite loops
    if (visited.has(obj)) {
      return '[Circular reference]';
    }
    visited.add(obj);

    // Enhanced prototype pollution protection
    if (obj.constructor && obj.constructor !== Object && obj.constructor !== Array) {
      return '[Non-plain object rejected]';
    }

    // Check for prototype pollution attempts more thoroughly
    const dangerousKeys = [
      '__proto__',
      'constructor',
      'prototype',
      '__defineGetter__',
      '__defineSetter__',
      '__lookupGetter__',
      '__lookupSetter__',
    ];
    for (const key in obj) {
      if (dangerousKeys.includes(key) || key.startsWith('__')) {
        return '[Potentially dangerous object]';
      }
    }

    // Handle arrays
    if (Array.isArray(obj)) {
      const cleanArray = [];
      const maxItems = Math.min(obj.length, 50); // Reduced limit

      for (let i = 0; i < maxItems; i++) {
        try {
          cleanArray.push(this.sanitizeObjectRecursive(obj[i], depth + 1, visited));
        } catch {
          cleanArray.push('[Item error]');
        }
      }

      if (obj.length > 50) {
        cleanArray.push('[Array truncated]');
      }

      return cleanArray;
    }

    // Security: Ultra-strict prototype pollution detection
    if (
      !obj ||
      obj.constructor !== Object ||
      Object.getPrototypeOf(obj) !== Object.prototype ||
      Object.getOwnPropertyNames(obj).some(
        name => name.includes('proto') || name.includes('constructor') || name.startsWith('__'),
      )
    ) {
      return '[Non-plain object rejected]';
    }

    // Check for prototype chain manipulation and dangerous getters
    try {
      // Verify object is truly plain with clean prototype chain
      if (Object.getPrototypeOf(Object.getPrototypeOf(obj)) !== null) {
        return '[Suspicious prototype chain]';
      }

      // Test for getters/setters that could be malicious
      for (const key in obj) {
        const descriptor = Object.getOwnPropertyDescriptor(obj, key);
        if (descriptor && (descriptor.get || descriptor.set)) {
          return '[Object with getters/setters]';
        }
      }

      // Safe JSON.stringify test with size validation
      const jsonStr = JSON.stringify(obj);
      if (!jsonStr || jsonStr === '{}' || jsonStr.length > 10000) {
        return '[Invalid or oversized JSON]';
      }
    } catch {
      return '[Object serialization failed]';
    }

    // Security: Create clean object without prototype
    const cleanObj = Object.create(null);

    // Strict key limiting and validation
    const keys = Object.keys(obj)
      .filter(key => {
        // Strict key validation
        return (
          key.length <= 50 &&
          /^[a-zA-Z0-9_.-]+$/.test(key) &&
          !key.startsWith('__') &&
          !['constructor', 'prototype', '__proto__'].includes(key)
        );
      })
      .slice(0, 20); // Further reduced limit

    // Security: Filter out dangerous keys and process safe ones
    for (const key of keys) {
      // Security: Reject prototype pollution keys
      if (
        key === '__proto__' ||
        key === 'constructor' ||
        key === 'prototype' ||
        key.startsWith('__')
      ) {
        continue;
      }

      // Security: Limit key length to prevent memory exhaustion
      if (key.length > 100) {
        continue;
      }

      // Security: Only allow safe key patterns
      if (!/^[a-zA-Z0-9_.-]+$/.test(key)) {
        continue;
      }

      try {
        cleanObj[key] = this.sanitizeObjectRecursive(obj[key], depth + 1, visited);
      } catch {
        // If sanitization of a property fails, skip it
        continue;
      }
    }

    return cleanObj;
  }

  /**
   * Validate input to prevent injection attacks and malformed data
   */
  private validateInput(
    level: string,
    type: string,
    action: string,
    message: string,
    metadata: any,
  ): boolean {
    // Validate required string fields
    if (!level || !type || !action || !message) {
      return false;
    }

    // Validate string lengths to prevent massive payloads
    if (level.length > 20 || type.length > 100 || action.length > 100 || message.length > 1000) {
      return false;
    }

    // Security: Use character-by-character validation to prevent ReDoS attacks
    // Replace regex with safe character set validation
    if (
      !this.isValidSafeString(level) ||
      !this.isValidSafeString(type) ||
      !this.isValidSafeString(action)
    ) {
      return false;
    }

    // Validate metadata size to prevent memory exhaustion
    if (metadata && typeof metadata === 'object') {
      const metadataStr = JSON.stringify(metadata);
      if (metadataStr.length > 10000) {
        // 10KB limit
        return false;
      }
    }

    return true;
  }

  // Security: Pre-computed allowed character ranges for memory efficiency
  private static readonly ALLOWED_CHAR_CODES = {
    // Letters: A-Z, a-z
    UPPER_A: 65,
    UPPER_Z: 90,
    LOWER_A: 97,
    LOWER_Z: 122,
    // Numbers: 0-9
    NUM_0: 48,
    NUM_9: 57,
    // Safe special characters (pre-computed for efficiency)
    SAFE_CHARS: new Set([
      32, // space
      33, // !
      35, // #
      36, // $
      37, // %
      38, // &
      40, // (
      41, // )
      43, // +
      44, // ,
      45, // -
      46, // .
      47, // /
      58, // :
      61, // =
      63, // ?
      64, // @
      91, // [
      92, // \
      93, // ]
      95, // _
      123, // {
      125, // }
    ]),
  };

  /**
   * Validate string contains only safe characters (memory-efficient implementation)
   */
  private isValidSafeString(str: string): boolean {
    if (!str || typeof str !== 'string') {
      return false;
    }

    // Security: Length limits to prevent processing very long strings
    const maxLength = 200;
    if (str.length > maxLength) {
      return false;
    }

    // Security: Memory-efficient character validation using character codes
    for (let i = 0; i < str.length; i++) {
      const charCode = str.charCodeAt(i);

      // Check if it's a letter (A-Z or a-z)
      if (
        (charCode >= AuditLogQueueService.ALLOWED_CHAR_CODES.UPPER_A &&
          charCode <= AuditLogQueueService.ALLOWED_CHAR_CODES.UPPER_Z) ||
        (charCode >= AuditLogQueueService.ALLOWED_CHAR_CODES.LOWER_A &&
          charCode <= AuditLogQueueService.ALLOWED_CHAR_CODES.LOWER_Z)
      ) {
        continue;
      }

      // Check if it's a number (0-9)
      if (
        charCode >= AuditLogQueueService.ALLOWED_CHAR_CODES.NUM_0 &&
        charCode <= AuditLogQueueService.ALLOWED_CHAR_CODES.NUM_9
      ) {
        continue;
      }

      // Check if it's a safe special character
      if (AuditLogQueueService.ALLOWED_CHAR_CODES.SAFE_CHARS.has(charCode)) {
        continue;
      }

      // Character not allowed
      return false;
    }

    return true;
  }

  /**
   * Check rate limiting to prevent DoS attacks (with memory leak protection)
   */
  private checkRateLimit(identifier: string): boolean {
    const now = Date.now();
    const userKey = identifier.slice(0, 50); // Limit key size

    // Proactive cleanup to prevent memory leaks
    if (this.requestCounts.size >= this.CLEANUP_THRESHOLD) {
      this.cleanupRateLimits();
    }

    // Security: Prevent unbounded Map growth with aggressive cleanup
    if (
      this.requestCounts.size >= this.MAX_RATE_LIMIT_ENTRIES &&
      !this.requestCounts.has(userKey)
    ) {
      // Force immediate cleanup before rejecting
      this.cleanupRateLimits();

      // If still at capacity after cleanup, reject
      if (this.requestCounts.size >= this.MAX_RATE_LIMIT_ENTRIES) {
        console.warn(
          `Rate limiting Map at capacity after cleanup (${this.requestCounts.size}), rejecting new identifier: ${userKey.substring(0, 20)}...`,
        );

        return false;
      }
    }

    // Get or create rate limit entry
    let entry = this.requestCounts.get(userKey);

    if (!entry || now > entry.resetTime) {
      // Reset or create new entry
      entry = { count: 0, resetTime: now + this.RATE_LIMIT_WINDOW };
      this.requestCounts.set(userKey, entry);
    }

    // Increment and check limit
    entry.count++;

    if (entry.count > this.MAX_REQUESTS_PER_MINUTE) {
      return false; // Rate limit exceeded
    }

    return true;
  }

  /**
   * Clean up old rate limit entries to prevent memory leaks (optimized)
   */
  private cleanupRateLimits(): void {
    const now = Date.now();
    let cleaned = 0;
    const beforeSize = this.requestCounts.size;

    // Direct iteration and deletion (more efficient)
    for (const [key, entry] of this.requestCounts.entries()) {
      if (now > entry.resetTime) {
        this.requestCounts.delete(key);
        cleaned++;
      }
    }

    // If still too large after cleanup, use optimized O(n) LRU eviction
    if (this.requestCounts.size > this.CLEANUP_THRESHOLD) {
      const excessCount = this.requestCounts.size - Math.floor(this.CLEANUP_THRESHOLD / 2);

      // Convert to array and sort by resetTime (oldest first) - O(n log n) but only when needed
      const entries = Array.from(this.requestCounts.entries())
        .sort((a, b) => a[1].resetTime - b[1].resetTime)
        .slice(0, excessCount); // Take only the excess entries

      // Remove oldest entries in single pass - O(n)
      for (const [key] of entries) {
        if (this.requestCounts.delete(key)) {
          cleaned++;
        }
      }
    }

    // Log cleanup results
    if (cleaned > 0) {
      console.warn(
        `Rate limit cleanup: removed ${cleaned} entries (${beforeSize} -> ${this.requestCounts.size})`,
      );
    }

    // Force garbage collection hint if available and cleanup was significant
    if (cleaned > 1000 && global.gc) {
      try {
        global.gc();
      } catch {
        // gc() not available, ignore
      }
    }
  }
}
