import { Injectable } from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { TransactionContextService } from './transaction-context.service';

/**
 * Centralized service for executing database transactions with context management
 * Combines TransactionService + TransactionContextService functionality
 * Eliminates code duplication across controllers
 */
@Injectable()
export class TransactionWithContextService {
  constructor(
    private readonly transactionService: TransactionService,
    private readonly transactionContext: TransactionContextService,
  ) {}

  /**
   * Execute a callback within a database transaction with proper context management
   * Automatically sets transaction client in context and cleans up afterwards
   *
   * @param callback Function to execute within the transaction
   * @returns Promise with the result of the callback
   */
  async executeInTransactionWithContext<T>(callback: () => Promise<T>): Promise<T> {
    return this.transactionService.executeInTransaction(async tx => {
      this.transactionContext.setTransactionClient(tx);

      try {
        return await callback();
      } finally {
        this.transactionContext.clearTransaction();
      }
    });
  }
}
