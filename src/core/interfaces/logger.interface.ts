/**
 * Logger interface for domain services
 *
 * This interface abstracts logging functionality to maintain Clean Architecture principles.
 * Domain services should depend on this abstraction, not on concrete implementations.
 */
export interface ILogger {
  /**
   * Set the context for log messages
   * @param context - The context/service name for log identification
   * @returns The logger instance for chaining
   */
  setContext(context: string): ILogger;

  /**
   * Log an informational message
   * @param message - The message to log
   * @param context - Optional context override
   */
  log(message: unknown, context?: string): void;

  /**
   * Log an error message
   * @param message - The error message to log
   * @param stack - Optional stack trace
   * @param context - Optional context override
   */
  error(message: unknown, stack?: string, context?: string): void;

  /**
   * Log a warning message
   * @param message - The warning message to log
   * @param context - Optional context override
   */
  warn(message: unknown, context?: string): void;

  /**
   * Log a debug message
   * @param message - The debug message to log
   * @param context - Optional context override
   */
  debug(message: unknown, context?: string): void;

  /**
   * Log a verbose message
   * @param message - The verbose message to log
   * @param context - Optional context override
   */
  verbose(message: unknown, context?: string): void;
}
