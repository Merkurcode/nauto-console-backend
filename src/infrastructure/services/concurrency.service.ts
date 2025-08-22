import { Inject, Injectable } from '@nestjs/common';
import Redis, { Cluster } from 'ioredis';
import { IConcurrencyService } from '@core/repositories/concurrency.service.interface';
import { LOGGER_SERVICE } from '@shared/constants/tokens';
import { ILogger } from '@core/interfaces/logger.interface';

type RedisClient = Redis | Cluster;

/**
 * ConcurrencyService
 *
 * - Controla concurrencia por usuario con contador en Redis.
 * - Mantiene un set de usuarios activos.
 * - Compatible con Redis Cluster usando hash-tags para co-ubicar keys.
 * - Limpia usuarios "fantasma" (sin contador) al calcular estadísticas.
 */
@Injectable()
export class ConcurrencyService implements IConcurrencyService {
  // Hash-tag para co-ubicar todas las keys en el mismo slot (Cluster-safe).
  // Nota: esto concentra la carga de "uploads" en un único slot/nodo.
  public static readonly HASH_TAG = '{uploads}';

  constructor(
    @Inject('REDIS') private readonly redis: RedisClient,
    @Inject(LOGGER_SERVICE) private readonly logger: ILogger,
  ) {}

  // ==== Keys helpers (mismo hash-slot) ====
  public userKey(userId: string): string {
    return `${ConcurrencyService.HASH_TAG}:inflight:${userId}`;
  }
  public activeUsersSet(): string {
    return `${ConcurrencyService.HASH_TAG}:active_users`;
  }

  // ==== Lua scripts (contador por usuario + set de usuarios activos) ====

  // Lua: ajusta contador con TTL; elimina si queda <= 0
  private static readonly adjustCounterWithTtlLua = `
    local key = KEYS[1]
    local delta = tonumber(ARGV[1])
    local ttl = tonumber(ARGV[2])

    if ttl <= 0 then
      return tonumber(redis.call('GET', key) or '0')
    end

    local curr = tonumber(redis.call('GET', key) or '0')
    local newv = curr + delta

    if newv <= 0 then
      redis.call('DEL', key)
      return 0
    else
      redis.call('SET', key, newv, 'EX', ttl)
      return newv
    end
  `;

  /**
   * acquire:
   * - Si max <= 0 o ttl <= 0 => no adquiere (retorna {0, nActual})
   * - Si n >= max => no adquiere (retorna {0, n})
   * - Si n <  max => n++, SET EX ttl, SADD usersSet; retorna {1, n}
   */
  private static readonly acquireLua = `
    local key      = KEYS[1]
    local usersSet = KEYS[2]
    local max      = tonumber(ARGV[1])
    local ttl      = tonumber(ARGV[2])
    local userId   = ARGV[3]

    if max <= 0 or ttl <= 0 then
      return {0, tonumber(redis.call('GET', key) or '0')}
    end

    local n = tonumber(redis.call('GET', key) or '0')
    if n >= max then
      return {0, n}
    end

    n = n + 1
    -- Refresca TTL y asegura presencia en el set (idempotente)
    redis.call('SET', key, n, 'EX', ttl)
    redis.call('SADD', usersSet, userId)
    return {1, n}
  `;

  /**
   * release:
   * - Si no existe => {0, 0}
   * - Si n <= 1 => DEL key, SREM usersSet, {1, 0}
   * - Si n >  1 => n--, KEEPTTL, {1, n}
   */
  private static readonly releaseLua = `
    local key      = KEYS[1]
    local usersSet = KEYS[2]
    local userId   = ARGV[1]

    local v = redis.call('GET', key)
    if not v then return {0, 0} end

    local n = tonumber(v)
    if n <= 1 then
      redis.call('DEL', key)
      redis.call('SREM', usersSet, userId)
      return {1, 0}
    else
      n = n - 1
      redis.call('SET', key, n, 'KEEPTTL')
      return {1, n}
    end
  `;

  /**
   * unlock seguro: elimina la key solo si el valor coincide
   */
  private static readonly unlockIfValueMatchesLua = `
    if redis.call('GET', KEYS[1]) == ARGV[1] then
      redis.call('DEL', KEYS[1])
      return 1
    else
      return 0
    end
  `;

  async adjustCounterWithTtl(key: string, delta: number, ttlSeconds: number): Promise<number> {
    try {
      const res = await this.redis.eval(
        ConcurrencyService.adjustCounterWithTtlLua,
        1,
        key,
        String(delta),
        String(ttlSeconds),
      );
      const n = typeof res === 'number' ? res : parseInt(String(res ?? 0), 10);

      return Number.isFinite(n) ? n : 0;
    } catch (err) {
      this.logger.debug(`adjustCounterWithTtl error: ${(err as Error).message}`);

      return 0; // política conservadora
    }
  }

  async deleteKey(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (err) {
      this.logger.debug(`deleteKey error: ${(err as Error).message}`);
    }
  }

  // ===================================================
  // Adquisición de slot (retorna si adquirió y conteo actual)
  // ===================================================
  async tryAcquireSlot(
    userId: string,
    maxConcurrent: number,
    ttlSeconds = 7200,
  ): Promise<{ acquired: boolean; current: number }> {
    if (!userId) return { acquired: false, current: 0 };
    if (!Number.isFinite(maxConcurrent)) return { acquired: false, current: 0 };

    const key = this.userKey(userId);
    const usersSet = this.activeUsersSet();

    try {
      const res = (await this.redis.eval(
        ConcurrencyService.acquireLua,
        2,
        key,
        usersSet,
        String(maxConcurrent),
        String(ttlSeconds),
        userId,
      )) as unknown as [number, number];

      const acquired = Array.isArray(res) && res[0] === 1;
      const currentRaw = Array.isArray(res) ? res[1] : 0;
      const current =
        typeof currentRaw === 'number' ? currentRaw : parseInt(String(currentRaw ?? 0), 10);

      return { acquired, current: Number.isFinite(current) ? current : 0 };
    } catch (e) {
      // Política de caída: FAIL-CLOSED para no exceder concurrencia
      // Si quisieras FAIL-OPEN, devuelve { acquired: true, current: 1 }
      this.logger.error(`tryAcquireSlot error for ${userId}: ${(e as Error).message}`);

      return { acquired: false, current: await this.getCurrentCount(userId).catch(() => 0) };
    }
  }

  // ===================================================
  // Liberación de slot (retorna conteo restante)
  // ===================================================
  async releaseSlot(userId: string): Promise<number> {
    if (!userId) return 0;

    const key = this.userKey(userId);
    const usersSet = this.activeUsersSet();

    try {
      const res = (await this.redis.eval(
        ConcurrencyService.releaseLua,
        2,
        key,
        usersSet,
        userId,
      )) as unknown as [number, number];

      const currentRaw = Array.isArray(res) ? res[1] : 0;
      const current =
        typeof currentRaw === 'number' ? currentRaw : parseInt(String(currentRaw ?? 0), 10);

      return Number.isFinite(current) ? current : 0;
    } catch (e) {
      this.logger.error(`releaseSlot error for ${userId}: ${(e as Error).message}`);

      return 0;
    }
  }

  // ===================================================
  // Conteo actual por usuario
  // ===================================================
  async getCurrentCount(userId: string): Promise<number> {
    if (!userId) return 0;
    const val = await this.redis.get(this.userKey(userId));

    return val ? parseInt(val as string, 10) || 0 : 0;
  }

  // ===================================================
  // Limpiar slots de un usuario (admin)
  // ===================================================
  async clearUserSlots(userId: string): Promise<void> {
    if (!userId) return;
    const key = this.userKey(userId);
    await this.redis.del(key);
    await this.redis.srem(this.activeUsersSet(), userId);
  }

  // ===================================================
  // Métricas globales sin KEYS (no bloqueante masivo)
  // - Filtra y limpia usuarios fantasma (sin contador > 0)
  // ===================================================
  async getStats(): Promise<{
    totalActiveUsers: number;
    totalActiveUploads: number;
    averageUploadsPerUser: number;
  }> {
    const users: string[] = (await this.redis.smembers(this.activeUsersSet())) ?? [];
    let totalActiveUsers = 0;
    let totalActiveUploads = 0;

    if (users.length) {
      const pipeline = this.redis.pipeline();
      for (const u of users) {
        pipeline.get(this.userKey(u));
      }
      const results = (await pipeline.exec()) as Array<[Error | null, string | null]>;

      const cleanup: string[] = [];
      results.forEach(([err, val], i) => {
        if (err) return;
        const n = val ? parseInt(val, 10) || 0 : 0;
        if (n > 0) {
          totalActiveUsers++;
          totalActiveUploads += n;
        } else {
          // Usuario en el set pero sin contador -> limpiar
          cleanup.push(users[i]);
        }
      });

      if (cleanup.length) {
        const p = this.redis.pipeline();
        cleanup.forEach(u => p.srem(this.activeUsersSet(), u));
        await p.exec();
      }
    }

    const averageUploadsPerUser =
      totalActiveUsers > 0 ? Math.round((totalActiveUploads / totalActiveUsers) * 100) / 100 : 0;

    return { totalActiveUsers, totalActiveUploads, averageUploadsPerUser };
  }

  // ===================================================
  // Lock simple con TTL (NX) y unlock seguro
  // ===================================================
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
      const r = await this.redis.eval(ConcurrencyService.unlockIfValueMatchesLua, 1, key, value);

      return r === 1;
    } catch (err) {
      this.logger.debug(`releaseSlotWithValue error: ${(err as Error).message}`);

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

  // ===================================================
  // Heartbeat opcional para cargas largas (extiende TTL sin tocar el contador)
  // ===================================================
  async heartbeat(userId: string, ttlSeconds = 7200): Promise<boolean> {
    try {
      if (!userId || ttlSeconds <= 0) return false;
      const key = this.userKey(userId);
      const exists = await this.redis.exists(key);
      if (!exists) return false;
      await this.redis.expire(key, ttlSeconds);

      return true;
    } catch (err) {
      this.logger.debug(`heartbeat error: ${(err as Error).message}`);

      return false;
    }
  }

  // ===================================================
  // Health check
  // ===================================================
  async healthCheck(): Promise<boolean> {
    try {
      await this.redis.ping();
      const testKey = `${ConcurrencyService.HASH_TAG}:healthcheck:test`;
      await this.redis.set(testKey, '1', 'EX', 5);
      const value = await this.redis.get(testKey);
      await this.redis.del(testKey);

      return value === '1';
    } catch (err) {
      this.logger.debug(`healthCheck error: ${(err as Error).message}`);

      return false;
    }
  }

  // ===================================================
  // Refresh TTL if value matches (CAS)
  // ===================================================
  async refreshSlotIfValue(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    try {
      if (!key || !value || ttlSeconds <= 0) return false;

      // Lua script for atomic CAS + EXPIRE
      const refreshLua = `
        if redis.call('GET', KEYS[1]) == ARGV[1] then
          return redis.call('EXPIRE', KEYS[1], tonumber(ARGV[2]))
        else
          return 0
        end
      `;

      const result = await this.redis.eval(refreshLua, 1, key, value, String(ttlSeconds));

      return result === 1;
    } catch (err) {
      this.logger.debug(`refreshSlotIfValue error: ${(err as Error).message}`);

      return false;
    }
  }
}
