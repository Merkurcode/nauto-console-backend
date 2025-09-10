import { ErrorSanitizationUtil } from '@core/utils/error-sanitization.util';
import { Inject, Optional } from '@nestjs/common';
import { LOGGER_SERVICE } from '@shared/constants/tokens';
import { ILogger } from '@core/interfaces/logger.interface';
import { IRepositoryError } from '@core/interfaces/repositories/query-filters.interface';
import { RequestCacheService } from '@infrastructure/caching/request-cache.service';

/**
 * Base repository class with common error handling
 * @template T - The entity type this repository manages
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export abstract class BaseRepository<T> {
  protected baseLogger?: ILogger;
  protected requestCache?: RequestCacheService;

  constructor(
    @Optional() @Inject(LOGGER_SERVICE) logger?: ILogger,
    @Optional() requestCache?: RequestCacheService,
  ) {
    this.baseLogger = logger;
    this.requestCache = requestCache;
  }

  /**
   * Handle repository errors
   * @param operation - The name of the operation that failed
   * @param error - The error that occurred
   * @param returnValue - Optional fallback value to return
   * @returns The fallback value
   */
  protected handleError<R>(
    operation: string,
    error: IRepositoryError | Error | unknown,
    returnValue: R | null = null,
  ): R | null {
    // Always log errors to console if logger is not available
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorDetails = {
      message: 'Repository operation failed',
      operation,
      errorMessage,
      entityType: this.constructor.name.replace('Repository', ''),
      errorType: error?.constructor?.name || 'Unknown',
    };

    if (this.baseLogger) {
      // SECURITY: Use logger with sanitized error information
      const sanitizedError = ErrorSanitizationUtil.forLogging(error, 'repository-error');
      const logDetails = {
        ...errorDetails,
        errorMessage: sanitizedError.message,
        // Only include stack in development
        ...(process.env.NODE_ENV === 'development' && {
          stack: sanitizedError.stack,
        }),
      };
      this.baseLogger.error(logDetails, sanitizedError.stack);
    } else {
      // INTENTIONAL FALLBACK: Console logging when Logger Service is not available
      // This ensures critical repository errors are never lost, even during DI container
      // initialization or when logger injection fails in specific contexts
      console.error('[REPOSITORY ERROR]', errorDetails);
    }

    return returnValue;
  }

  /**
   * Execute a database operation with error handling and request-scoped caching
   * @param operation - The name of the operation to perform
   * @param action - The async function to execute
   * @param fallbackValue - Optional fallback value to return on error
   * @param cacheParams - Parameters to use for cache key generation
   * @returns The result of the action or the fallback value on error
   * @template R - The return type of the operation
   */
  protected async executeWithErrorHandling<R>(
    operation: string,
    action: () => Promise<R>,
    fallbackValue?: R,
    cacheParams?: unknown,
    useCacheParamsForCache: boolean = true,
  ): Promise<R | undefined> {
    const entityType = this.constructor.name.replace('Repository', '');
    const doCache = useCacheParamsForCache ? (cacheParams ? true : false) : true;

    // Try to get from cache first
    if (doCache && this.requestCache) {
      // doCache <-- only if requested by function
      const cachedResult = this.requestCache.get<R>(entityType, operation, cacheParams);
      if (cachedResult !== undefined) {
        if (this.baseLogger) {
          this.baseLogger.debug({
            message: 'Repository operation served from cache',
            operation,
            entityType,
            cacheParams: cacheParams ? 'present' : 'none',
          });
        }

        return cachedResult;
      }
    }

    try {
      if (this.baseLogger) {
        this.baseLogger.debug({
          message: 'Repository operation started',
          operation,
          entityType,
          cacheParams: cacheParams ? 'present' : 'none',
        });
      }

      const start = performance.now();
      const result = await action();
      const duration = performance.now() - start;
      let cached = false;

      // Cache the result
      if (doCache && this.requestCache && result !== undefined) {
        this.requestCache.set(entityType, operation, cacheParams, result);
        cached = true;
      }

      if (this.baseLogger) {
        this.baseLogger.debug({
          message: 'Repository operation completed',
          operation,
          entityType,
          duration: `${duration}ms`,
          cached: cached ? 'yes' : 'no',
        });
      }

      return result;
    } catch (error) {
      // Log the error but DON'T swallow it - let it propagate
      this.handleError<R>(operation, error, fallbackValue);

      // Re-throw the error so the caller knows something went wrong
      // This is critical for authentication flows
      throw error;
    }
  }

  /**
   * Invalidate cache entry for specific parameters
   * @param cacheParams - Parameters used for cache key generation
   */
  protected async invalidateCache(cacheParams?: unknown): Promise<void> {
    if (this.requestCache) {
      const entityType = this.constructor.name.replace('Repository', '');
      this.requestCache.invalidate(entityType, cacheParams);

      if (this.baseLogger) {
        this.baseLogger.debug({
          message: 'Cache invalidated',
          entityType,
          cacheParams: cacheParams ? 'present' : 'none',
        });
      }
    }
  }

  /**
   * Clear all cache entries for this repository
   */
  protected async clearAllCache(): Promise<void> {
    if (this.requestCache) {
      const entityType = this.constructor.name.replace('Repository', '');
      this.requestCache.clearAll(entityType);

      if (this.baseLogger) {
        this.baseLogger.debug({
          message: 'All cache cleared',
          entityType,
        });
      }
    }
  }
}
