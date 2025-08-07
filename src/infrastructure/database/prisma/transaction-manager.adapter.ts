import { Injectable } from '@nestjs/common';
import { TransactionService } from './transaction.service';
import { ITransactionManager } from '@core/interfaces/transaction-manager.interface';

/**
 * Infrastructure adapter that implements the domain's transaction manager interface
 * Following Clean Architecture - infrastructure implements domain contracts
 */
@Injectable()
export class TransactionManagerAdapter implements ITransactionManager {
  constructor(private readonly transactionService: TransactionService) {}

  async executeInTransaction<T>(callback: () => Promise<T>): Promise<T> {
    return this.transactionService.executeInTransaction(callback);
  }
}
