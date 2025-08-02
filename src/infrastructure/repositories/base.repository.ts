import { LoggerService } from '@infrastructure/logger/logger.service';

/**
 * Base repository class with common error handling
 * @template T - The entity type this repository manages
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export abstract class BaseRepository<T> {
  protected logger: LoggerService;

  constructor() {
    // We'll disable logging in base repository for now to avoid injection issues
    this.logger = null;
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
    if (this.logger) {
      if (error instanceof Error) {
        this.logger.error(
          {
            message: `Repository operation failed`,
            operation,
            errorMessage: error.message,
            entityType: this.constructor.name.replace('Repository', ''),
          },
          error.stack,
        );
      } else {
        this.logger.error({
          message: `Repository operation failed`,
          operation,
          error: String(error),
          entityType: this.constructor.name.replace('Repository', ''),
        });
      }
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
      if (this.logger) {
        this.logger.debug({
          message: `Repository operation started`,
          operation,
          entityType: this.constructor.name.replace('Repository', ''),
          entityId,
        });
      }

      const startTime = Date.now();
      const result = await action();
      const duration = Date.now() - startTime;

      if (this.logger) {
        this.logger.debug({
          message: `Repository operation completed`,
          operation,
          entityType: this.constructor.name.replace('Repository', ''),
          entityId,
          duration: `${duration}ms`,
        });
      }

      return result;
    } catch (error) {
      return this.handleError<R>(operation, error, fallbackValue);
    }
  }
}
