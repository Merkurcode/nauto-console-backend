import { ErrorSanitizationUtil } from '@core/utils/error-sanitization.util';
import { Inject, Optional } from '@nestjs/common';
import { LOGGER_SERVICE } from '@shared/constants/tokens';
import { ILogger } from '@core/interfaces/logger.interface';

/**
 * Base repository class with common error handling
 * @template T - The entity type this repository manages
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export abstract class BaseRepository<T> {
  protected baseLogger?: ILogger;

  constructor(@Optional() @Inject(LOGGER_SERVICE) logger?: ILogger) {
    this.baseLogger = logger;
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
    error: unknown,
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
      // Fallback to console if no logger available
      console.error('[REPOSITORY ERROR]', errorDetails);
    }

    return returnValue;
  }

  /**
   * Execute a database operation with error handling
   * @param operation - The name of the operation to perform
   * @param action - The async function to execute
   * @param fallbackValue - Optional fallback value to return on error
   * @returns The result of the action or the fallback value on error
   * @template R - The return type of the operation
   */
  protected async executeWithErrorHandling<R>(
    operation: string,
    action: () => Promise<R>,
    fallbackValue?: R,
    entityId?: string,
  ): Promise<R | undefined> {
    try {
      if (this.baseLogger) {
        this.baseLogger.debug({
          message: 'Repository operation started',
          operation,
          entityType: this.constructor.name.replace('Repository', ''),
          entityId,
        });
      }

      const start = performance.now();
      const result = await action();
      const duration = performance.now() - start;

      if (this.baseLogger) {
        this.baseLogger.debug({
          message: 'Repository operation completed',
          operation,
          entityType: this.constructor.name.replace('Repository', ''),
          entityId,
          duration: `${duration}ms`,
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
}
