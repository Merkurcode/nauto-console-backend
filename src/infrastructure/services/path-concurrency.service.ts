// path-lock.service.ts
import { Inject, Injectable } from '@nestjs/common';
import Redis, { Cluster } from 'ioredis';
import { randomUUID } from 'crypto';
import { REDIS_CLIENT } from '@shared/constants/tokens';

// 👇 importa SOLO tipos para evitar ciclos en runtime (ajusta la ruta)
import type {
  IPathConcurrencyService,
  IPathLockRetryOptions,
  IPathLockTryAcquireResult,
} from '../../core/repositories/path-concurrency.service.interface';

type RedisClient = Redis | Cluster;
export type Awaitable<T> = T | Promise<T>;

export interface IPathLockOptions {
  /** Namespace/tenant/bucket para aislar y enrutar en Cluster (obligatorio). */
  namespace: string;
  /** Ruta a bloquear: "files/2025" o "files/2025/". */
  path: string;
  /** TTL del lock en ms (default 60_000). */
  ttlMs?: number;
  /** Tiempo máximo para intentar adquirir (ms). 0=un intento (default 5_000). */
  acquireTimeoutMs?: number;
  /** Delay base de reintento (ms, default 50). */
  retryDelayMs?: number;
  /** Factor máximo de backoff exponencial (default 8). */
  maxBackoffFactor?: number;
  /**
   * Modo estricto: si true, bloquear "a/b/c" también impide bloquear *cualquier*
   * otra rama que comparta ancestro (p.ej. hermano "a/x").
   * Por defecto false (paralelismo seguro por subárbol).
   */
  strictSiblings?: boolean;
}

type RedisWithCmds = RedisClient & {
  pathLockAcquire(
    selfKey: string,
    selfDescKey: string,
    token: string | number,
    ttlSec: string | number,
    m: string | number,
    ...rest: Array<string | number> // ancLockKeys..., ancDescKeys..., strictFlag
  ): Promise<[number, number]>;
  pathLockRelease(
    selfKey: string,
    token: string,
    m: string | number,
    ...ancDescKeys: string[]
  ): Promise<number>;
  pathLockRefresh(
    selfKey: string,
    token: string,
    ttlSec: string | number,
    m: string | number,
    ...ancDescKeys: string[]
  ): Promise<number>;
};

@Injectable()
export class PathConcurrencyService implements IPathConcurrencyService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: RedisClient) {
    // Registrar scripts con defineCommand (usa EVALSHA bajo el capó)
    this.redis.defineCommand('pathLockAcquire', {
      numberOfKeys: 2, // KEYS[1]=selfLock, KEYS[2]=selfDesc
      lua: PathConcurrencyService.ACQUIRE_LUA,
    });
    this.redis.defineCommand('pathLockRelease', {
      numberOfKeys: 1, // KEYS[1]=selfLock
      lua: PathConcurrencyService.RELEASE_LUA,
    });
    this.redis.defineCommand('pathLockRefresh', {
      numberOfKeys: 1, // KEYS[1]=selfLock
      lua: PathConcurrencyService.REFRESH_LUA,
    });
  }

  private get R(): RedisWithCmds {
    return this.redis as RedisWithCmds;
  }

  // ===================== LUA SCRIPTS =====================

  /**
   * ACQUIRE
   * KEYS[1] = self lock key  (path:{ns}:lock:<P>)
   * KEYS[2] = self desc key  (path:{ns}:desc:<P>)
   * ARGV[1] = token
   * ARGV[2] = ttlSeconds
   * ARGV[3] = m (#ancestros)
   * ARGV[4..3+m]      = ancestorLockKeys[i]
   * ARGV[4+m..3+2m]   = ancestorDescKeys[i]
   * ARGV[4+2m]        = strict (0/1)
   * Returns:
   *   {1,0} OK
   *   {0,1} ancestro bloqueado
   *   {0,2} self ya bloqueado
   *   {0,3} self tiene descendientes bloqueados
   *   {0,4} (estricto) ancestro con descendientes ocupados
   */
  private static readonly ACQUIRE_LUA = `
    local self = KEYS[1]
    local selfDesc = KEYS[2]
    local token = ARGV[1]
    local ttl = tonumber(ARGV[2])
    local m = tonumber(ARGV[3])
    local strict = tonumber(ARGV[4 + 2*m] or '0')

    -- (A) si YO tengo descendientes ocupados, no puedo bloquearme (evita bloquear ancestro mientras hay hijos)
    if tonumber(redis.call('GET', selfDesc) or '0') > 0 then
      return {0, 3}
    end

    -- (B) ancestros con lock directo
    for i=1,m do
      local al = ARGV[3+i]
      if redis.call('EXISTS', al) == 1 then
        return {0, 1}
      end
    end

    -- (B.estricto) bloquear hermanos si ancestro tiene descendientes ocupados
    if strict == 1 then
      for i=1,m do
        local ad = ARGV[3+m+i]
        if tonumber(redis.call('GET', ad) or '0') > 0 then
          return {0, 4}
        end
      end
    end

    -- (C) lock propio
    if redis.call('SET', self, token, 'NX', 'EX', ttl) ~= 'OK' then
      return {0, 2}
    end

    -- (D) incrementa contadores de descendientes en ancestros
    for i=1,m do
      local ad = ARGV[3+m+i]
      redis.call('INCR', ad)
      if ttl > 0 then redis.call('EXPIRE', ad, ttl) end
    end

    return {1, 0}
  `;

  /**
   * RELEASE
   * KEYS[1] = self lock key
   * ARGV[1] = token
   * ARGV[2] = m
   * ARGV[3..2+m] = ancestorDescKeys[i]
   * Return: 1 si liberó, 0 si token no coincide
   */
  private static readonly RELEASE_LUA = `
    local self = KEYS[1]
    local token = ARGV[1]
    local m = tonumber(ARGV[2])

    if redis.call('GET', self) ~= token then
      return 0
    end

    redis.call('DEL', self)

    for i=1,m do
      local ad = ARGV[2+i]
      local v = tonumber(redis.call('DECR', ad) or '0')
      if v <= 0 then redis.call('DEL', ad) end
    end

    return 1
  `;

  /**
   * REFRESH
   * KEYS[1] = self lock key
   * ARGV[1] = token
   * ARGV[2] = ttlSeconds
   * ARGV[3] = m
   * ARGV[4..3+m] = ancestorDescKeys[i]
   * Return: 1 si refrescó, 0 si token no coincide
   */
  private static readonly REFRESH_LUA = `
    local self = KEYS[1]
    local token = ARGV[1]
    local ttl = tonumber(ARGV[2])
    local m = tonumber(ARGV[3])

    if redis.call('GET', self) ~= token then
      return 0
    end

    redis.call('EXPIRE', self, ttl)

    for i=1,m do
      local ad = ARGV[3+i]
      if redis.call('EXISTS', ad) == 1 then
        redis.call('EXPIRE', ad, ttl)
      end
    end

    return 1
  `;

  // ===================== API =====================

  /** Ejecuta `operation` con la ruta bloqueada; libera al final. */
  async withPathLock<T>(opts: IPathLockOptions, operation: () => Awaitable<T>): Promise<T> {
    const ns = this.mustNamespace(opts.namespace);
    const path = this.normalize(opts.path);
    const ttlMs = Math.max(1000, Math.floor(opts.ttlMs ?? 60_000));

    const acquired = await this.tryAcquire(ns, path, ttlMs, {
      acquireTimeoutMs: opts.acquireTimeoutMs ?? 5_000,
      retryDelayMs: opts.retryDelayMs ?? 50,
      maxBackoffFactor: opts.maxBackoffFactor ?? 8,
      strictSiblings: !!opts.strictSiblings,
    });
    if (!acquired.ok) {
      throw new Error(`La ruta "${path}" ya está en uso (ns="${ns}").`);
    }
    const token = acquired.token!;

    try {
      return await operation();
    } finally {
      await this.release(ns, path, token).catch(() => {});
    }
  }

  /**
   * Intenta adquirir el lock (para usos manuales/avanzados).
   * Devuelve { ok, token } si tuvo éxito.
   */
  async tryAcquire(
    namespace: string,
    normalizedPath: string,
    ttlMs: number,
    retry?: IPathLockRetryOptions,
  ): Promise<IPathLockTryAcquireResult> {
    const ns = this.mustNamespace(namespace);
    const path = this.normalize(normalizedPath);
    const token = `${Date.now()}_${randomUUID()}`;
    const ttlSec = Math.ceil(Math.max(1000, ttlMs) / 1000);

    const selfKey = this.selfLockKey(ns, path);
    const selfDescKey = this.descKey(ns, path);
    const ancestors = this.ancestorsOf(path);
    const ancLockKeys = ancestors.map(a => this.selfLockKey(ns, a));
    const ancDescKeys = ancestors.map(a => this.descKey(ns, a));
    const strictFlag = retry?.strictSiblings ? '1' : '0';

    const attempt = async () => {
      const res = await this.R.pathLockAcquire(
        selfKey,
        selfDescKey,
        token,
        ttlSec,
        ancestors.length,
        ...ancLockKeys,
        ...ancDescKeys,
        strictFlag,
      );

      return Array.isArray(res) && Number(res[0]) === 1;
    };

    const ok = await this.tryWithBackoff(attempt, retry);

    return ok ? { ok: true, token } : { ok: false };
  }

  /** Libera el lock (CAS por token). */
  async release(namespace: string, normalizedPath: string, token: string): Promise<boolean> {
    const ns = this.mustNamespace(namespace);
    const path = this.normalize(normalizedPath);

    const selfKey = this.selfLockKey(ns, path);
    const ancestors = this.ancestorsOf(path);
    const ancDescKeys = ancestors.map(a => this.descKey(ns, a));

    const r = await this.R.pathLockRelease(selfKey, token, ancestors.length, ...ancDescKeys);

    return r === 1;
  }

  /** Refresca el TTL si el token coincide (útil en operaciones largas). */
  async refresh(
    namespace: string,
    normalizedPath: string,
    token: string,
    ttlMs: number,
  ): Promise<boolean> {
    const ns = this.mustNamespace(namespace);
    const path = this.normalize(normalizedPath);
    const ttlSec = Math.ceil(Math.max(1000, ttlMs) / 1000);

    const selfKey = this.selfLockKey(ns, path);
    const ancestors = this.ancestorsOf(path);
    const ancDescKeys = ancestors.map(a => this.descKey(ns, a));

    const r = await this.R.pathLockRefresh(
      selfKey,
      token,
      ttlSec,
      ancestors.length,
      ...ancDescKeys,
    );

    return r === 1;
  }

  // ===================== HELPERS =====================

  /** Normaliza a forma de carpeta con slash final: "files/2025/". */
  normalize(input: string): string {
    if (!input || typeof input !== 'string') throw new Error('path requerido');
    let p = input;
    try {
      p = decodeURIComponent(p);
    } catch {}
    p = p.replace(/\\/g, '/'); // \ -> /
    p = p.replace(/\/+/g, '/'); // // -> /
    p = p.trim();
    p = p.replace(/^\/+|\/+$/g, ''); // sin / al inicio/fin
    const parts = p.split('/').filter(Boolean);
    // niega traversal
    for (const seg of parts) if (seg === '.' || seg === '..') throw new Error('path traversal');
    const norm = parts.join('/') + '/';
    if (Buffer.byteLength(norm, 'utf8') > 768) throw new Error('path demasiado largo');

    return norm;
  }

  /** Ancestros propios (excluye el path en sí): "a/b/c/" -> ["a/","a/b/"] */
  ancestorsOf(normPath: string): string[] {
    const parts = normPath.replace(/\/$/, '').split('/');
    const res: string[] = [];
    for (let i = 1; i < parts.length; i++) {
      res.push(parts.slice(0, i).join('/') + '/');
    }

    return res;
  }

  /** Hash-tag por namespace para Cluster: todas las keys del ns comparten slot. */
  private tag(ns: string) {
    return `{pathns:${ns}}`;
  }
  private selfLockKey(ns: string, normPath: string) {
    return `path:${this.tag(ns)}:lock:${normPath}`;
  }
  private descKey(ns: string, normPath: string) {
    return `path:${this.tag(ns)}:desc:${normPath}`;
  }
  private mustNamespace(ns: string) {
    const s = (ns ?? '').toString().trim();
    if (!s) throw new Error('namespace requerido');

    return s;
  }

  private async tryWithBackoff(
    attempt: () => Awaitable<boolean>,
    retry?: IPathLockRetryOptions,
  ): Promise<boolean> {
    const acquireTimeoutMs = Math.max(0, retry?.acquireTimeoutMs ?? 5000);
    const retryDelayMs = Math.max(10, retry?.retryDelayMs ?? 50);
    const maxBackoffFactor = Math.max(1, retry?.maxBackoffFactor ?? 8);

    let attemptNo = 0;
    const deadline = acquireTimeoutMs > 0 ? Date.now() + acquireTimeoutMs : undefined;

    while (true) {
      if (await attempt()) return true;
      if (deadline === undefined || Date.now() >= deadline) return false;
      attemptNo++;
      const factor = Math.min(maxBackoffFactor, 2 ** attemptNo);
      const jitter = Math.floor(Math.random() * retryDelayMs);
      const wait = Math.min(retryDelayMs * factor + jitter, Math.max(0, deadline - Date.now()));
      if (wait <= 0) return false;
      await new Promise(r => setTimeout(r, wait));
    }
  }
}
