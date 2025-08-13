import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
  Optional,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, finalize } from 'rxjs/operators';
import { RequestCacheService } from './request-cache.service';
import { ILogger } from '@core/interfaces/logger.interface';
import { LOGGER_SERVICE } from '@shared/constants/tokens';

/**
 * Request Cache Interceptor
 *
 * This interceptor provides automatic cache management for HTTP requests:
 * 1. Allows caching of database operations during request processing
 * 2. Automatically clears cache at the end of each request
 * 3. Provides optional cache statistics logging
 */
@Injectable()
export class RequestCacheInterceptor implements NestInterceptor {
  constructor(
    private readonly requestCache: RequestCacheService,
    @Optional() @Inject(LOGGER_SERVICE) private readonly logger?: ILogger,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const isHttpRequest = context.getType() === 'http';

    // Only apply caching to HTTP requests
    if (!isHttpRequest) {
      return next.handle();
    }

    const startTime = Date.now();

    return next.handle().pipe(
      tap(() => {
        // Optional: Log cache performance on successful requests
        if (process.env.NODE_ENV === 'development' && this.logger) {
          const stats = this.requestCache.getStats();
          if (stats.totalEntries > 0) {
            this.logger.debug({
              message: 'Request cache statistics',
              url: request.url,
              method: request.method,
              cacheStats: stats,
              requestDuration: Date.now() - startTime,
            });
          }
        }
      }),
      finalize(() => {
        // Always clear cache at the end of request (success or error)
        try {
          const stats = this.requestCache.getStats();

          // Log cache effectiveness for monitoring
          if (stats.totalEntries > 0 && process.env.NODE_ENV === 'development' && this.logger) {
            this.logger.debug({
              message: 'Request cache cleanup',
              url: request.url,
              method: request.method,
              finalStats: stats,
              totalDuration: Date.now() - startTime,
            });
          }

          this.requestCache.clear();
        } catch (error) {
          // Ensure cache is cleared even if logging fails
          if (this.logger) {
            this.logger.error({
              message: 'Failed to clear request cache',
              error: error instanceof Error ? error.message : String(error),
            });
          }
          try {
            this.requestCache.clear();
          } catch (clearError) {
            if (this.logger) {
              this.logger.error({
                message: 'Critical: Failed to clear cache after error',
                clearError: clearError instanceof Error ? clearError.message : String(clearError),
              });
            }
          }
        }
      }),
    );
  }
}
