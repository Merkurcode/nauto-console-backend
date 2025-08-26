// concurrency.service.ts
import { Inject, Injectable } from '@nestjs/common';
import Redis, { Cluster } from 'ioredis';
import { IConcurrencyService } from '@core/repositories/concurrency.service.interface';
import { LOGGER_SERVICE, REDIS_CLIENT } from '@shared/constants/tokens';
import { ILogger } from '@core/interfaces/logger.interface';

type RedisClient = Redis | Cluster;

type RedisWithCmds = RedisClient & {
  acquireSlot(
    key: string,
    max: string | number,
    ttl: string | number,
  ): Promise<[number, number, number]>; // ok, n, transitionedUp
  releaseSlot(key: string): Promise<[number, number, number]>; // ok, n, transitionedDown
  safeDecrement(key: string, dec: string | number, ttl: string | number): Promise<[number, number]>;
  unlockIfValueMatches(key: string, val: string): Promise<number>;
  refreshIfValue(key: string, val: string, ttl: string | number): Promise<number>;
  adjustCounterWithTtl(key: string, delta: string | number, ttl: string | number): Promise<number>;
};

@Injectable()
export class ConcurrencyService implements IConcurrencyService {
  /** Se mantiene para compatibilidad con código externo que lo consulte */
  public static readonly HASH_TAG = '{uploads}';

  /** Si true, mantenemos un índice de usuarios activos (best-effort) */
  private readonly useActiveIndex = true;
  /** Set (global) para listar usuarios activos — mismo nombre que el viejito */
  private readonly ACTIVE_SET_KEY = `${ConcurrencyService.HASH_TAG}:active_users`;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: RedisClient,
    @Inject(LOGGER_SERVICE) private readonly logger: ILogger,
  ) {
    // Registrar scripts como comandos (usa EVALSHA bajo el capó)
    this.redis.defineCommand('acquireSlot', {
      numberOfKeys: 1,
      lua: ConcurrencyService.acquireLua,
    });
    this.redis.defineCommand('releaseSlot', {
      numberOfKeys: 1,
      lua: ConcurrencyService.releaseLua,
    });
    this.redis.defineCommand('safeDecrement', {
      numberOfKeys: 1,
      lua: ConcurrencyService.safeDecrementLua,
    });
    this.redis.defineCommand('unlockIfValueMatches', {
      numberOfKeys: 1,
      lua: ConcurrencyService.unlockIfValueMatchesLua,
    });
    this.redis.defineCommand('refreshIfValue', {
      numberOfKeys: 1,
      lua: `
        if redis.call('GET', KEYS[1]) == ARGV[1] then
          return redis.call('EXPIRE', KEYS[1], tonumber(ARGV[2]))
        else
          return 0
        end
      `,
    });
    this.redis.defineCommand('adjustCounterWithTtl', {
      numberOfKeys: 1,
      lua: ConcurrencyService.adjustCounterWithTtlLua,
    });
  }

  private get R(): RedisWithCmds {
    return this.redis as RedisWithCmds;
  }

  // =================== Keys (cluster-safe por usuario) ===================
  /** Contador de concurrencia (hash-tag por usuario para distribuir carga) */
  private static counterKey(userId: string) {
    return `uploads:{${userId}}:inflight`;
  }
  /** Reserva de cuota por usuario (mismo slot del user) */
  public static reservedQuotaKey(userId: string) {
    return `uploads:{${userId}}:quota:reserved`;
  }

  // ===== Helpers de compatibilidad (mismo contrato público que el viejito) ====
  /** Mantiene compat: el worker usa esto para construir el key de usuario */
  public userKey(userId: string): string {
    return ConcurrencyService.counterKey(userId);
  }
  /** Mantiene compat: el worker escanea este set */
  public activeUsersSet(): string {
    return this.ACTIVE_SET_KEY;
  }

  // =================== Lua scripts ===================
  // Acquire: retorna {ok, n, transitionedUp}
  private static readonly acquireLua = `
    local key = KEYS[1]
    local max = tonumber(ARGV[1])
    local ttl = tonumber(ARGV[2])

    if max <= 0 or ttl <= 0 then
      return {0, tonumber(redis.call('GET', key) or '0'), 0}
    end

    local prev = tonumber(redis.call('GET', key) or '0')
    if prev >= max then
      return {0, prev, 0}
    end

    local n = prev + 1
    redis.call('SET', key, n, 'EX', ttl)
    local transitioned = (prev == 0 and n == 1) and 1 or 0
    return {1, n, transitioned}
  `;

  // Release: retorna {ok, n, transitionedDown}
  private static readonly releaseLua = `
    local key = KEYS[1]
    local v = redis.call('GET', key)
    if not v then return {0, 0, 0} end

    local n = tonumber(v)
    if n <= 1 then
      redis.call('DEL', key)
      return {1, 0, 1}
    else
      n = n - 1
      local pttl = redis.call('PTTL', key)
      if pttl and pttl > 0 then
        redis.call('SET', key, n, 'PX', pttl)
      else
        redis.call('SET', key, n)
      end
      return {1, n, 0}
    end
  `;

  private static readonly safeDecrementLua = `
    local key = KEYS[1]
    local dec = tonumber(ARGV[1])
    local ttl = tonumber(ARGV[2])

    if dec <= 0 then
      local curr = tonumber(redis.call('GET', key) or '0')
      return {0, curr}
    end

    local curr = tonumber(redis.call('GET', key) or '0')
    if curr < dec then
      return {0, curr}
    end

    local newv = curr - dec
    if newv <= 0 then
      redis.call('DEL', key)
      return {1, 0}
    else
      if ttl > 0 then
        -- CHANGED: si se especifica ttl, lo forzamos
        redis.call('SET', key, newv, 'EX', ttl)
      else
        -- CHANGED: conservar TTL existente (si lo hay)
        local pttl = redis.call('PTTL', key)
        if pttl and pttl > 0 then
          redis.call('SET', key, newv, 'PX', pttl)
        else
          redis.call('SET', key, newv)
        end
      end
      return {1, newv}
    end
  `;

  private static readonly unlockIfValueMatchesLua = `
    if redis.call('GET', KEYS[1]) == ARGV[1] then
      redis.call('DEL', KEYS[1])
      return 1
    else
      return 0
    end
  `;

  /** Ajusta un contador con TTL (permite delta ±, no deja < 0). */
  private static readonly adjustCounterWithTtlLua = `
    local key = KEYS[1]
    local delta = tonumber(ARGV[1])
    local ttl = tonumber(ARGV[2])

    local curr = tonumber(redis.call('GET', key) or '0')
    local newv = curr + delta

    if newv <= 0 then
      redis.call('DEL', key)
      return 0
    else
      if ttl > 0 then
        redis.call('SET', key, newv, 'EX', ttl)
      else
        redis.call('SET', key, newv)
      end
      return newv
    end
  `;

  // =================== API pública ===================

  /** Limita concurrencia por usuario (atomiza ++ y TTL). */
  async tryAcquireSlot(
    userId: string,
    maxConcurrent: number,
    ttlSeconds = 7200,
  ): Promise<{ acquired: boolean; current: number }> {
    if (!userId || !Number.isFinite(maxConcurrent) || maxConcurrent <= 0 || ttlSeconds <= 0) {
      return { acquired: false, current: 0 };
    }
    try {
      const [ok, n, transitionedUp] = await this.R.acquireSlot(
        ConcurrencyService.counterKey(userId),
        maxConcurrent,
        ttlSeconds,
      );

      // Mantén índice de activos (best-effort) SIN bloquear el hot path
      if (this.useActiveIndex && ok === 1 && transitionedUp === 1) {
        this.redis.sadd(this.ACTIVE_SET_KEY, userId).catch(() => {});
      }

      return { acquired: ok === 1, current: Math.max(0, Number(n) || 0) };
    } catch (e) {
      this.logger.error(`tryAcquireSlot error for ${userId}: ${(e as Error).message}`);

      return { acquired: false, current: await this.getCurrentCount(userId).catch(() => 0) };
    }
  }

  /** Libera un slot (atomiza -- y conserva TTL restante). */
  async releaseSlot(userId: string): Promise<number> {
    if (!userId) return 0;
    try {
      const [, n, transitionedDown] = await this.R.releaseSlot(
        ConcurrencyService.counterKey(userId),
      );
      if (this.useActiveIndex && transitionedDown === 1) {
        this.redis.srem(this.ACTIVE_SET_KEY, userId).catch(() => {});
      }

      return Math.max(0, Number(n) || 0);
    } catch (e) {
      this.logger.error(`releaseSlot error for ${userId}: ${(e as Error).message}`);

      return 0;
    }
  }

  /** Decremento seguro (para consumir reservas sin quedar en negativo). */
  async safeDecrementCounter(
    key: string,
    decrementAmount: number,
    ttlSeconds: number,
  ): Promise<{ success: boolean; remainingValue: number; wasFullyReleased: boolean }> {
    try {
      const [ok, val] = await this.R.safeDecrement(key, decrementAmount, ttlSeconds);
      const remaining = Number(val) || 0;

      return {
        success: ok === 1,
        remainingValue: remaining,
        wasFullyReleased: ok === 1 && remaining === 0,
      };
    } catch (err) {
      this.logger.debug(`safeDecrementCounter error: ${(err as Error).message}`);

      return { success: false, remainingValue: 0, wasFullyReleased: false };
    }
  }

  /** Ajusta contador con TTL (útil para reservas de cuota). */
  async adjustCounterWithTtl(key: string, delta: number, ttlSeconds: number): Promise<number> {
    try {
      const res = await this.R.adjustCounterWithTtl(key, delta, ttlSeconds);
      const n = typeof res === 'number' ? res : parseInt(String(res ?? 0), 10);

      return Number.isFinite(n) ? n : 0;
    } catch (err) {
      this.logger.debug(`adjustCounterWithTtl error: ${(err as Error).message}`);

      return 0;
    }
  }

  /** Valor actual del contador de concurrencia para un usuario. */
  async getCurrentCount(userId: string): Promise<number> {
    if (!userId) return 0;
    const val = await this.redis.get(ConcurrencyService.counterKey(userId));

    return val ? parseInt(val as string, 10) || 0 : 0;
  }

  /** Compat: obtener valor de cualquier key numérica */
  async getCurrentValue(key: string): Promise<number> {
    if (!key) return 0;
    const val = await this.redis.get(key);

    return val ? parseInt(val as string, 10) || 0 : 0;
  }

  // ---- Locks para FileLockService (CAS) ----
  async setSlot(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    try {
      if (!key || !value || ttlSeconds <= 0) return false;
      const result = await this.redis.set(key, value, 'EX', ttlSeconds, 'NX');

      return result === 'OK';
    } catch (err) {
      this.logger.debug(`setSlot error: ${(err as Error).message}`);

      return false;
    }
  }

  async releaseSlotWithValue(key: string, value: string): Promise<boolean> {
    try {
      if (!key || !value) return false;
      const r = await this.R.unlockIfValueMatches(key, value);

      return r === 1;
    } catch (err) {
      this.logger.debug(`releaseSlotWithValue error: ${(err as Error).message}`);

      return false;
    }
  }

  async refreshSlotIfValue(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    try {
      if (!key || !value || ttlSeconds <= 0) return false;
      const r = await this.R.refreshIfValue(key, value, ttlSeconds);

      return r === 1;
    } catch (err) {
      this.logger.debug(`refreshSlotIfValue error: ${(err as Error).message}`);

      return false;
    }
  }

  async getSlotInfo(key: string): Promise<{ exists: boolean; value?: string }> {
    try {
      if (!key) return { exists: false };
      const value = await this.redis.get(key);

      return { exists: value !== null, value: value ?? undefined };
    } catch (err) {
      this.logger.debug(`getSlotInfo error: ${(err as Error).message}`);

      return { exists: false };
    }
  }

  // ---- Admin / opcionales ----
  async deleteKey(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (err) {
      this.logger.debug(`deleteKey error: ${(err as Error).message}`);
    }
  }

  /** Limpia el contador de concurrencia de un usuario (admin). */
  async clearUserSlots(userId: string): Promise<void> {
    if (!userId) return;
    try {
      await this.redis.del(ConcurrencyService.counterKey(userId));
      if (this.useActiveIndex) {
        await this.redis.srem(this.ACTIVE_SET_KEY, userId);
      }
    } catch (err) {
      this.logger.debug(`clearUserSlots error: ${(err as Error).message}`);
    }
  }

  /** Opcional: reservas de cuota */
  async reserveQuota(userId: string, bytes: number, ttlSeconds: number): Promise<number> {
    if (!userId || !Number.isFinite(bytes) || bytes <= 0 || ttlSeconds <= 0) return 0;

    return this.adjustCounterWithTtl(
      ConcurrencyService.reservedQuotaKey(userId),
      bytes,
      ttlSeconds,
    );
  }
  async consumeQuota(userId: string, bytes: number, ttlSeconds: number) {
    if (!userId || !Number.isFinite(bytes) || bytes <= 0 || ttlSeconds <= 0) {
      return { success: false, remainingValue: 0, wasFullyReleased: false };
    }

    return this.safeDecrementCounter(
      ConcurrencyService.reservedQuotaKey(userId),
      bytes,
      ttlSeconds,
    );
  }
  async resetUserQuota(userId: string): Promise<void> {
    if (!userId) return;
    await this.deleteKey(ConcurrencyService.reservedQuotaKey(userId));
  }

  /** Mantiene viva la key de concurrencia sin cambiar su valor. */
  async heartbeat(userId: string, ttlSeconds = 7200): Promise<boolean> {
    try {
      if (!userId || ttlSeconds <= 0) return false;
      const ok = await this.redis.expire(ConcurrencyService.counterKey(userId), ttlSeconds);

      return ok === 1;
    } catch (err) {
      this.logger.debug(`heartbeat error: ${(err as Error).message}`);

      return false;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.redis.ping();
      const testKey = `hc:{uploads}:test`;
      await this.redis.set(testKey, '1', 'EX', 5);
      const value = await this.redis.get(testKey);
      await this.redis.del(testKey);

      return value === '1';
    } catch (err) {
      this.logger.debug(`healthCheck error: ${(err as Error).message}`);

      return false;
    }
  }

  /** Métricas sencillas + limpieza de “fantasmas” (compat con el viejito) */
  async getStats(): Promise<{
    totalActiveUsers: number;
    totalActiveUploads: number;
    averageUploadsPerUser: number;
  }> {
    const setKey = this.activeUsersSet();
    const users: string[] = (await this.redis.smembers(setKey)) ?? [];
    let totalActiveUsers = 0;
    let totalActiveUploads = 0;

    if (users.length) {
      const pipeline = this.redis.pipeline();
      for (const u of users) pipeline.get(this.userKey(u));
      const results = (await pipeline.exec()) as Array<[Error | null, string | null]>;

      const cleanup: string[] = [];
      results.forEach(([err, val], i) => {
        if (err) return;
        const n = val ? parseInt(val, 10) || 0 : 0;
        if (n > 0) {
          totalActiveUsers++;
          totalActiveUploads += n;
        } else {
          cleanup.push(users[i]);
        }
      });

      if (cleanup.length) {
        const p2 = this.redis.pipeline();
        cleanup.forEach(u => p2.srem(setKey, u));
        await p2.exec();
      }
    }

    const averageUploadsPerUser =
      totalActiveUsers > 0 ? Math.round((totalActiveUploads / totalActiveUsers) * 100) / 100 : 0;

    return { totalActiveUsers, totalActiveUploads, averageUploadsPerUser };
  }
}
