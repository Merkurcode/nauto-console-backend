/**
 * Domain interface for transaction management
 * Following Clean Architecture - domain layer defines the contract
 */
export interface ITransactionManager {
  /**
   * Execute a callback within a database transaction
   * Implementation details are handled by infrastructure layer
   */
  executeInTransaction<T>(callback: () => Promise<T>): Promise<T>;
}
