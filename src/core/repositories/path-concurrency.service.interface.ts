import { IPathLockOptions } from '@infrastructure/services/path-concurrency.service';

type Awaitable<T> = T | Promise<T>;

/**
 * Opciones de reintento para adquirir un lock de ruta.
 */
export interface IPathLockRetryOptions {
  /**
   * Tiempo máximo total para intentar adquirir el lock, en milisegundos.
   * - `0` => se hace **un único intento** (sin reintentos).
   * - Default típico: `5000`.
   */
  acquireTimeoutMs?: number;

  /**
   * Pausa base entre reintentos, en milisegundos.
   * Se usa con backoff exponencial + jitter.
   * - Default: `50`.
   */
  retryDelayMs?: number;

  /**
   * Límite superior del factor de backoff exponencial (2^n).
   * - Default: `8`.
   */
  maxBackoffFactor?: number;

  /**
   * Si `true`, habilita el modo "estricto con hermanos":
   * además de impedir conflictos con ancestros/hijos, **también** deniega
   * cuando algún **ancestro** tiene descendientes bloqueados (bloquea ramas hermanas).
   * - Default: `false` (permite paralelismo seguro en subárboles distintos).
   */
  strictSiblings?: boolean;
}

/**
 * Resultado de un intento de adquisición "manual".
 */
export interface IPathLockTryAcquireResult {
  /**
   * `true` si se adquirió el lock; `false` si no.
   */
  ok: boolean;

  /**
   * Token único asociado al lock cuando `ok === true`.
   * Se requiere para `release` y `refresh`. Si no se adquirió, es `undefined`.
   */
  token?: string;
}

/**
 * Servicio de exclusión mutua por **ruta jerárquica**.
 *
 * ### Garantías clave
 * - Bloqueo **exclusivo** de una ruta normalizada (siempre en formato de “carpeta” con `/` final).
 * - Previene conflictos con **ancestros** y/o **descendientes**.
 * - Admite modo estricto para evitar paralelismo entre **ramas hermanas** (`strictSiblings`).
 * - Locks con **TTL** y comparación segura por **token** para liberar/renovar.
 * - Compatible con Redis Cluster (co-ubicación de claves por namespace).
 *
 * ### Semántica de conflicto
 * Dada una ruta `p`:
 * - No puedes bloquear `p` si algún **ancestro** de `p` ya está bloqueado.
 * - No puedes bloquear `p` si `p` tiene al menos un **descendiente** bloqueado.
 * - En modo `strictSiblings: true`, tampoco puedes bloquear `p` si **algún ancestro tiene descendientes bloqueados** (es decir, bloquea también ramas hermanas).
 *
 * ### Normalización de rutas
 * - Siempre se normalizan a la forma `a/b/c/`:
 *   - Se eliminan barras repetidas y las de inicio/fin.
 *   - Se prohíben `.` y `..` (traversal).
 *   - Se asegura la barra final `/`.
 */
export interface IPathConcurrencyService {
  /**
   * Ejecuta `operation` bajo un **lock exclusivo** de la ruta.
   * Libera el lock automáticamente al finalizar (éxito o error).
   *
   * @typeParam T - Tipo del valor que devuelve `operation`.
   *
   * @param opts.namespace
   * Namespace/tenant/bucket que agrupa y aísla locks.
   * También se usa para hash-tag en Redis Cluster (evita CROSSSLOT).
   *
   * @param opts.path
   * Ruta a bloquear (p.ej. `"files/2025"` o `"files/2025/"`).
   * Se **normaliza** internamente a forma de carpeta `files/2025/`.
   *
   * @param opts.ttlMs
   * TTL del lock en milisegundos (mínimo 1000ms).
   * Si la operación es larga, considera invocar `refresh` periódicamente desde
   * la propia implementación (o usa un heartbeat externo).
   * - Default: `60_000`.
   *
   * @param opts.acquireTimeoutMs
   * Tiempo máximo para **intentar adquirir** el lock (con backoff + jitter).
   * `0` => un solo intento sin reintentos.
   * - Default: `5000`.
   *
   * @param opts.retryDelayMs
   * Pausa base entre reintentos (backoff exponencial).
   * - Default: `50`.
   *
   * @param opts.maxBackoffFactor
   * Factor máximo del backoff exponencial.
   * - Default: `8`.
   *
   * @param opts.strictSiblings
   * Si `true`, en lugar de permitir paralelismo entre subárboles hermanos,
   * se deniega cuando el **ancestro** ya tiene **algún** descendiente bloqueado.
   * - Default: `false`.
   *
   * @param operation
   * Función a ejecutar dentro de la región crítica de la ruta bloqueada.
   *
   * @returns
   * El valor devuelto por `operation`.
   *
   * @throws
   * Lanza error si no pudo adquirir el lock dentro de `acquireTimeoutMs`.
   *
   * @example
   * ```ts
   * await pathLocks.withPathLock(
   *   { namespace: "bucketA", path: "files/2025", ttlMs: 30_000 },
   *   async () => {
   *     // trabajo exclusivo bajo "files/2025/"
   *   }
   * );
   * ```
   */
  withPathLock<T>(opts: IPathLockOptions, operation: () => Awaitable<T>): Promise<T>;

  /**
   * Intenta **adquirir** el lock de una ruta (uso avanzado/manual).
   * No libera automáticamente; debes llamar a `release` con el **token**.
   *
   * @param namespace
   * Namespace/tenant/bucket que agrupa y aísla locks.
   * (Obligatorio; se usa para hash-tag en Redis Cluster).
   *
   * @param normalizedPath
   * Ruta a bloquear. **Puede** venir normalizada o no; la implementación
   * normaliza igualmente (trim, colapsa barras, prohíbe `.`/`..`, añade `/` final).
   *
   * @param ttlMs
   * TTL del lock en milisegundos (mínimo 1000ms).
   *
   * @param retry
   * Parámetros de reintento (backoff exponencial + jitter).
   * Incluye `strictSiblings` para el modo estricto.
   *
   * @returns
   * `{ ok: true, token }` si se adquirió; `{ ok: false }` si no se pudo (por conflicto/timeout).
   *
   * @example
   * ```ts
   * const { ok, token } = await pathLocks.tryAcquire("bucketA", "files/2025", 60_000, {
   *   acquireTimeoutMs: 5_000,
   *   strictSiblings: false,
   * });
   * if (!ok) throw new Error("No se pudo bloquear");
   * try {
   *   // trabajo...
   * } finally {
   *   await pathLocks.release("bucketA", "files/2025", token!);
   * }
   * ```
   */
  tryAcquire(
    namespace: string,
    normalizedPath: string,
    ttlMs: number,
    retry?: IPathLockRetryOptions,
  ): Promise<IPathLockTryAcquireResult>;

  /**
   * **Libera** el lock de una ruta si el `token` coincide (CAS).
   * Si el token no coincide o el lock no existe, devuelve `false`.
   *
   * @param namespace
   * Mismo namespace usado al adquirir.
   *
   * @param normalizedPath
   * Ruta a liberar (la implementación normaliza internamente).
   *
   * @param token
   * Token devuelto por `tryAcquire`/`withPathLock`.
   *
   * @returns
   * `true` si liberó; `false` si el token no coincide o ya no existía el lock.
   */
  release(namespace: string, normalizedPath: string, token: string): Promise<boolean>;

  /**
   * **Renueva** el TTL del lock si el `token` coincide.
   * Útil para operaciones largas donde el lock debe seguir vivo.
   *
   * @param namespace
   * Mismo namespace usado al adquirir.
   *
   * @param normalizedPath
   * Ruta cuyo lock se desea refrescar (la implementación normaliza internamente).
   *
   * @param token
   * Token devuelto por `tryAcquire`/`withPathLock`.
   *
   * @param ttlMs
   * Nuevo TTL en milisegundos (mínimo 1000ms).
   *
   * @returns
   * `true` si se renovó; `false` si el token no coincide o el lock ya no existe.
   */
  refresh(
    namespace: string,
    normalizedPath: string,
    token: string,
    ttlMs: number,
  ): Promise<boolean>;

  // ------------------ Utilidades públicas ------------------

  /**
   * Normaliza un path a forma de “carpeta” con `/` final:
   * - Colapsa barras, elimina barras al inicio/fin, prohíbe `.` y `..`.
   * - Lanza si el path resultante supera el límite de bytes o es inválido.
   *
   * @param input Path de entrada (ej. `"files//2025"` o `"/files/2025/"`).
   * @returns Path normalizado (ej. `"files/2025/"`).
   */
  normalize(input: string): string;

  /**
   * Devuelve los **ancestros** de un path normalizado (excluyendo el propio path).
   * Ej.: `"a/b/c/"` => `["a/", "a/b/"]`.
   *
   * @param normPath Path **ya** normalizado (termina en `/`).
   * @returns Lista de ancestros en orden ascendente.
   */
  ancestorsOf(normPath: string): string[];
}
