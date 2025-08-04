/**
 * Database Health Interface
 * Provides abstraction for database health checking operations
 */
export interface IDatabaseHealth {
  /**
   * Test database connectivity
   * @throws DatabaseConnectionException if connection fails
   */
  testConnection(): Promise<void>;
}
