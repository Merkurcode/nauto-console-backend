import { Injectable, Inject } from '@nestjs/common';
import { IConcurrencyService } from '@core/repositories/concurrency.service.interface';
import { CONCURRENCY_SERVICE, LOGGER_SERVICE } from '@shared/constants/tokens';
import { randomUUID } from 'crypto';
import { ILogger } from '@core/interfaces/logger.interface';

type Awaitable<T> = T | Promise<T>;

export interface ILockOptions {
  /** TTL del lock (ms). Default: 30s */
  lockTtlMs?: number;
  /** Tiempo máximo para intentar adquirir el lock (ms). Default: 0 = un solo intento */
  acquireTimeoutMs?: number;
  /** Delay base entre reintentos (ms). Default: 50ms */
  retryDelayMs?: number;
  /** Factor máximo para jitter exponencial. Default: 8 */
  maxBackoffFactor?: number;
}

/**
 * File Lock Service
 * Locks basados en SET NX EX + compare-and-delete (CAS) con valor aleatorio.
 * Incluye reintentos con backoff y deadline global para adquisiciones múltiples.
 */
@Injectable()
export class FileLockService {
  constructor(
    @Inject(CONCURRENCY_SERVICE)
    private readonly concurrencyService: IConcurrencyService,
    @Inject(LOGGER_SERVICE)
    private readonly logger: ILogger,
  ) {}

  // ---------------------------
  // Helpers
  // ---------------------------
  private sleep(ms: number) {
    return new Promise<void>(res => setTimeout(res, ms));
  }

  /** Redis EX usa segundos enteros; redondeamos hacia arriba y aplicamos mínimo 1s */
  private toSeconds(ms: number) {
    return Math.max(1, Math.ceil(ms / 1000));
  }

  private defaults(opts?: ILockOptions): Required<ILockOptions> {
    const lockTtlMs = Math.max(1000, Math.floor(opts?.lockTtlMs ?? 30_000)); // ≥1s
    const acquireTimeoutMs = Math.max(0, Math.floor(opts?.acquireTimeoutMs ?? 0));
    const retryDelayMs = Math.max(10, Math.floor(opts?.retryDelayMs ?? 50)); // ≥10ms para evitar busy-wait
    const maxBackoffFactor = Math.max(1, Math.floor(opts?.maxBackoffFactor ?? 8));

    return { lockTtlMs, acquireTimeoutMs, retryDelayMs, maxBackoffFactor };
  }

  /**
   * Intenta adquirir un lock con backoff exponencial + jitter.
   * - Si hay `globalDeadline`, lo respeta.
   * - Si NO hay `globalDeadline` y `acquireTimeoutMs=0` => un solo intento.
   * - Si NO hay `globalDeadline` y `acquireTimeoutMs>0` => reintenta hasta agotar ese presupuesto.
   */
  private async tryAcquireWithBackoff(
    key: string,
    value: string,
    opts: Required<ILockOptions>,
    globalDeadline?: number,
  ): Promise<boolean> {
    let attempt = 0;
    const hasGlobalDeadline = Number.isFinite(globalDeadline as number);
    const localDeadline =
      !hasGlobalDeadline && opts.acquireTimeoutMs > 0
        ? Date.now() + opts.acquireTimeoutMs
        : undefined;

    while (true) {
      const ok = await this.concurrencyService.setSlot(key, value, this.toSeconds(opts.lockTtlMs));
      if (ok) return true;

      attempt++;

      const now = Date.now();
      const effectiveDeadline = hasGlobalDeadline ? globalDeadline! : localDeadline;

      // Un solo intento si no hay deadline alguno
      if (effectiveDeadline === undefined) return false;
      if (now >= effectiveDeadline) return false;

      // Backoff exponencial con jitter [0, retryDelayMs)
      const factor = Math.min(opts.maxBackoffFactor, 2 ** attempt);
      const jitter = Math.floor(Math.random() * opts.retryDelayMs);
      const wait = Math.min(
        opts.retryDelayMs * factor + jitter,
        Math.max(0, effectiveDeadline - now),
      );
      if (wait <= 0) return false;

      await this.sleep(wait);
    }
  }

  /**
   * Inicia heartbeat para refrescar TTL de locks (si el servicio lo soporta).
   * Devuelve función para detener el heartbeat.
   */
  private startHeartbeat(keys: string[], value: string, ttlMs: number): (() => void) | undefined {
    // Refrescar al ~60% del TTL; si es muy bajo, omitimos heartbeat
    const intervalMs = Math.floor(ttlMs * 0.6);
    if (intervalMs < 1000) return undefined;

    const timer = setInterval(() => {
      void Promise.all(
        keys.map(key =>
          this.concurrencyService.refreshSlotIfValue(key, value, this.toSeconds(ttlMs)),
        ),
      ).catch((err: Error) => {
        this.logger.debug(`Heartbeat refresh failed: ${err.message}`);
      });
    }, intervalMs);

    // No mantener vivo el proceso por el timer (si el runtime lo soporta)
    timer?.unref?.();

    return () => clearInterval(timer);
  }

  // ---------------------------
  // API pública
  // ---------------------------

  /**
   * Ejecuta una operación con lock exclusivo por archivo.
   * @param timeoutMs DEPRECADO: alias de opts.lockTtlMs
   */
  async withFileLock<T>(
    fileId: string,
    operation: () => Awaitable<T>,
    timeoutMs?: number,
    opts?: ILockOptions,
  ): Promise<T> {
    const options = this.defaults(
      timeoutMs !== null && timeoutMs !== undefined ? { ...opts, lockTtlMs: timeoutMs } : opts,
    );

    const lockKey = `file_lock:${fileId}`;
    const lockValue = `${Date.now()}_${randomUUID()}`;

    const acquired = await this.tryAcquireWithBackoff(lockKey, lockValue, options);
    if (!acquired) {
      throw new Error(`Failed to acquire lock for file ${fileId}. File may be in use.`);
    }

    const stopHeartbeat = this.startHeartbeat([lockKey], lockValue, options.lockTtlMs);

    try {
      return await operation();
    } finally {
      stopHeartbeat?.();
      try {
        await this.concurrencyService.releaseSlotWithValue(lockKey, lockValue);
      } catch (err) {
        this.logger.warn(`Failed to release lock for file ${fileId}: ${(err as Error).message}`);
      }
    }
  }

  /**
   * Ejecuta una operación con lock por usuario.
   * @param timeoutMs DEPRECADO: alias de opts.lockTtlMs
   */
  async withUserLock<T>(
    userId: string,
    operation: () => Awaitable<T>,
    timeoutMs?: number,
    opts?: ILockOptions,
  ): Promise<T> {
    const options = this.defaults(
      timeoutMs !== null && timeoutMs !== undefined ? { ...opts, lockTtlMs: timeoutMs } : opts,
    );

    const lockKey = `user_lock:${userId}`;
    const lockValue = `${Date.now()}_${randomUUID()}`;

    const acquired = await this.tryAcquireWithBackoff(lockKey, lockValue, options);
    if (!acquired) {
      throw new Error(`User ${userId} has concurrent operations in progress. Please wait.`);
    }

    const stopHeartbeat = this.startHeartbeat([lockKey], lockValue, options.lockTtlMs);

    try {
      return await operation();
    } finally {
      stopHeartbeat?.();
      try {
        await this.concurrencyService.releaseSlotWithValue(lockKey, lockValue);
      } catch (err) {
        this.logger.warn(`Failed to release user lock for ${userId}: ${(err as Error).message}`);
      }
    }
  }

  /**
   * Lock para chequeos de cuota.
   * @param timeoutMs DEPRECADO: alias de opts.lockTtlMs
   */
  async withQuotaLock<T>(
    userId: string,
    operation: () => Awaitable<T>,
    timeoutMs?: number,
    opts?: ILockOptions,
  ): Promise<T> {
    const options = this.defaults(
      timeoutMs !== null && timeoutMs !== undefined ? { ...opts, lockTtlMs: timeoutMs } : opts,
    );

    const lockKey = `quota_lock:${userId}`;
    const lockValue = `${Date.now()}_${randomUUID()}`;

    const acquired = await this.tryAcquireWithBackoff(lockKey, lockValue, options);
    if (!acquired) {
      throw new Error(`Quota check in progress for user ${userId}. Please retry.`);
    }

    const stopHeartbeat = this.startHeartbeat([lockKey], lockValue, options.lockTtlMs);

    try {
      return await operation();
    } finally {
      stopHeartbeat?.();
      try {
        await this.concurrencyService.releaseSlotWithValue(lockKey, lockValue);
      } catch (err) {
        this.logger.warn(`Failed to release quota lock for ${userId}: ${(err as Error).message}`);
      }
    }
  }

  /**
   * Lock de múltiples archivos (evita deadlock ordenando IDs).
   * @param opts.lockTtlMs TTL del lock
   * @param opts.acquireTimeoutMs tiempo total para adquirir todos los locks (deadline global)
   */
  async withMultipleFileLocks<T>(
    fileIds: string[],
    operation: () => Awaitable<T>,
    opts?: ILockOptions,
  ): Promise<T> {
    const options = this.defaults(opts);

    // Normalizamos: quitamos vacíos y duplicados
    const dedup = Array.from(new Set((fileIds ?? []).filter(Boolean)));
    if (dedup.length === 0) {
      return operation();
    }

    // Orden lexicográfico estable para evitar deadlocks
    const sorted = dedup.sort();
    const lockKeys = sorted.map(id => `file_lock:${id}`);
    const lockValue = randomUUID();
    const acquiredLocks: string[] = [];

    // Deadline global para todas las adquisiciones
    const globalDeadline =
      options.acquireTimeoutMs > 0 ? Date.now() + options.acquireTimeoutMs : undefined;

    try {
      for (const key of lockKeys) {
        // Bajo presupuesto global, no repartimos por lock; cada intento respeta globalDeadline
        const ok = await this.tryAcquireWithBackoff(key, lockValue, options, globalDeadline);
        if (!ok) throw new Error(`Failed to acquire lock for key ${key}`);
        acquiredLocks.push(key);
      }

      const stopHeartbeat = this.startHeartbeat(acquiredLocks, lockValue, options.lockTtlMs);
      try {
        return await operation();
      } finally {
        stopHeartbeat?.();
      }
    } finally {
      if (acquiredLocks.length) {
        await Promise.allSettled(
          acquiredLocks.map(key => this.concurrencyService.releaseSlotWithValue(key, lockValue)),
        );
      }
    }
  }

  /**
   * ¿Está un archivo bloqueado?
   */
  async isFileLocked(fileId: string): Promise<boolean> {
    const lockKey = `file_lock:${fileId}`;
    try {
      const info = await this.concurrencyService.getSlotInfo(lockKey);

      return !!info?.exists;
    } catch {
      return false;
    }
  }

  /**
   * Liberación "forzada" pero segura (CAS).
   * Si necesitas DEL incondicional, añade un método específico en IConcurrencyService.
   */
  async forceReleaseLock(fileId: string): Promise<boolean> {
    const lockKey = `file_lock:${fileId}`;
    try {
      const info = await this.concurrencyService.getSlotInfo(lockKey);
      if (!info?.exists || !info.value) return false;

      return await this.concurrencyService.releaseSlotWithValue(lockKey, info.value);
    } catch {
      return false;
    }
  }
}
