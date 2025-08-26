// folder-lock.service.ts
import { Injectable, Inject } from '@nestjs/common';
//import { randomUUID } from 'crypto';

import { ILogger } from '@core/interfaces/logger.interface';
import { LOGGER_SERVICE, PATH_CONCURRENCY_SERVICE } from '@shared/constants/tokens';

import type {
  IPathConcurrencyService,
  IPathLockRetryOptions,
} from '@core/repositories/path-concurrency.service.interface';

type Awaitable<T> = T | Promise<T>;

export interface IFolderLockOptions {
  /** TTL del lock (ms). Default: 60s */
  lockTtlMs?: number;
  /** Tiempo máximo para intentar adquirir el/los locks (ms). Default: 5s */
  acquireTimeoutMs?: number;
  /** Delay base entre reintentos (ms). Default: 50ms */
  retryDelayMs?: number;
  /** Factor máximo para jitter exponencial. Default: 8 */
  maxBackoffFactor?: number;
  /**
   * Modo estricto (hermanos): si true, bloquear "a/b/" impide bloquear ramas hermanas
   * si el ancestro ya tiene descendientes bloqueados. Default: false
   */
  strictSiblings?: boolean;
}

@Injectable()
export class FolderLockService {
  constructor(
    @Inject(PATH_CONCURRENCY_SERVICE)
    private readonly pathLocks: IPathConcurrencyService,
    @Inject(LOGGER_SERVICE)
    private readonly logger: ILogger,
  ) {}

  // ---------------------------
  // Helpers
  // ---------------------------
  private sleep(ms: number) {
    return new Promise<void>(res => setTimeout(res, ms));
  }

  private defaults(opts?: IFolderLockOptions): Required<IFolderLockOptions> {
    const lockTtlMs = Math.max(1000, Math.floor(opts?.lockTtlMs ?? 60_000));
    const acquireTimeoutMs = Math.max(0, Math.floor(opts?.acquireTimeoutMs ?? 5_000));
    const retryDelayMs = Math.max(10, Math.floor(opts?.retryDelayMs ?? 50));
    const maxBackoffFactor = Math.max(1, Math.floor(opts?.maxBackoffFactor ?? 8));
    const strictSiblings = !!opts?.strictSiblings;

    return { lockTtlMs, acquireTimeoutMs, retryDelayMs, maxBackoffFactor, strictSiblings };
  }

  /** Normaliza y colapsa rutas solapadas: si hay ancestros/hijos, conserva solo el ancestro. */
  private normalizeAndCollapse(namespace: string, paths: string[]) {
    const ns = (namespace ?? '').trim();
    if (!ns) throw new Error('namespace requerido');
    const normalized = (paths ?? []).map(p => this.pathLocks.normalize(p)).filter(Boolean);

    // Orden por profundidad (asc) y luego lexicográfico
    normalized.sort((a, b) => {
      const da = a.split('/').length;
      const db = b.split('/').length;
      if (da !== db) return da - db;

      return a.localeCompare(b);
    });

    const result: string[] = [];
    for (const p of normalized) {
      if (!result.some(prev => p.startsWith(prev))) {
        result.push(p);
      } else {
        // Si p está cubierto por un ancestro ya agregado, lo omitimos silenciosamente
        this.logger.debug?.(`Collapsing overlapped path "${p}" (covered by ancestor)`);
      }
    }

    return { namespace: ns, paths: result };
  }

  /** Inicia heartbeat para refrescar TTL de N locks. */
  private startHeartbeat(
    namespace: string,
    locks: Array<{ path: string; token: string }>,
    ttlMs: number,
  ): (() => void) | undefined {
    const intervalMs = Math.floor(ttlMs * 0.6);
    if (intervalMs < 1000 || locks.length === 0) return undefined;

    const timer = setInterval(() => {
      void Promise.all(
        locks.map(({ path, token }) => this.pathLocks.refresh(namespace, path, token, ttlMs)),
      ).catch((err: Error) => {
        this.logger.debug?.(`FolderLockService heartbeat refresh failed: ${err.message}`);
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
   * Ejecuta una operación con lock exclusivo por carpeta (ruta jerárquica).
   * La ruta se normaliza a forma "a/b/.../".
   */
  async withFolderLock<T>(
    namespace: string,
    folderPath: string,
    operation: () => Awaitable<T>,
    opts?: IFolderLockOptions,
  ): Promise<T> {
    const options = this.defaults(opts);
    const retry: IPathLockRetryOptions = {
      acquireTimeoutMs: options.acquireTimeoutMs,
      retryDelayMs: options.retryDelayMs,
      maxBackoffFactor: options.maxBackoffFactor,
      strictSiblings: options.strictSiblings,
    };

    const norm = this.pathLocks.normalize(folderPath);
    //const token = `${Date.now()}_${randomUUID()}`;

    // Intento manual para poder gestionar heartbeat como en FileLockService
    const start = Date.now();
    const attempt = async () => {
      const left =
        options.acquireTimeoutMs > 0
          ? Math.max(1, options.acquireTimeoutMs - (Date.now() - start))
          : 0;
      const localRetry: IPathLockRetryOptions = { ...retry, acquireTimeoutMs: left };
      const { ok, token: acquired } = await this.pathLocks.tryAcquire(
        namespace,
        norm,
        options.lockTtlMs,
        localRetry,
      );
      if (ok && acquired) return acquired;

      return undefined;
    };

    const acquiredToken = await attempt();
    if (!acquiredToken) {
      throw new Error(`Folder "${norm}" is in use (ns="${namespace}").`);
    }

    const stopHeartbeat = this.startHeartbeat(
      namespace,
      [{ path: norm, token: acquiredToken }],
      options.lockTtlMs,
    );

    try {
      return await operation();
    } finally {
      stopHeartbeat?.();
      try {
        await this.pathLocks.release(namespace, norm, acquiredToken);
      } catch (err) {
        this.logger.warn?.(
          `Failed to release folder lock ${norm} (ns="${namespace}"): ${(err as Error).message}`,
        );
      }
    }
  }

  /**
   * Ejecuta una operación con múltiples locks de carpetas.
   * - Colapsa rutas solapadas (mantiene solo ancestros).
   * - Ordena adquisición determinísticamente para evitar deadlocks.
   * - Usa un deadline global (acquireTimeoutMs) repartido entre locks.
   */
  async withMultipleFolderLocks<T>(
    namespace: string,
    folderPaths: string[],
    operation: () => Awaitable<T>,
    opts?: IFolderLockOptions,
  ): Promise<T> {
    const options = this.defaults(opts);

    const { paths } = this.normalizeAndCollapse(namespace, folderPaths);
    if (paths.length === 0) return operation();

    const retryBase: IPathLockRetryOptions = {
      acquireTimeoutMs: options.acquireTimeoutMs,
      retryDelayMs: options.retryDelayMs,
      maxBackoffFactor: options.maxBackoffFactor,
      strictSiblings: options.strictSiblings,
    };

    const acquired: Array<{ path: string; token: string }> = [];
    const start = Date.now();

    try {
      for (const p of paths) {
        const left =
          options.acquireTimeoutMs > 0
            ? Math.max(1, options.acquireTimeoutMs - (Date.now() - start))
            : 0;
        const retry: IPathLockRetryOptions = { ...retryBase, acquireTimeoutMs: left };

        const { ok, token } = await this.pathLocks.tryAcquire(
          namespace,
          p,
          options.lockTtlMs,
          retry,
        );
        if (!ok || !token) {
          throw new Error(`Failed to acquire folder lock for "${p}" (ns="${namespace}").`);
        }
        acquired.push({ path: p, token });
      }

      const stopHeartbeat = this.startHeartbeat(namespace, acquired, options.lockTtlMs);
      try {
        return await operation();
      } finally {
        stopHeartbeat?.();
      }
    } finally {
      if (acquired.length) {
        await Promise.allSettled(
          acquired.map(({ path, token }) => this.pathLocks.release(namespace, path, token)),
        );
      }
    }
  }
}
