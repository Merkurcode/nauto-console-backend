import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { TransactionContextService } from './transaction-context.service';
import { Prisma } from '@prisma/client';

export type TransactionClient = Prisma.TransactionClient;

@Injectable()
export class TransactionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactionContext: TransactionContextService,
  ) {}

  /**
   * Execute a function within a database transaction
   * If any error occurs, the transaction is automatically rolled back
   * @param callback Function to execute within the transaction - can optionally receive transaction client
   * @returns Promise with the result of the callback
   */
  async executeInTransaction<T>(
    callback: ((tx?: TransactionClient) => Promise<T>) | (() => Promise<T>),
  ): Promise<T> {
    return await this.prisma.$transaction(async tx => {
      // Set transaction context for repositories
      this.transactionContext.setTransactionClient(tx);
      try {
        // Call callback with tx parameter if it accepts it, otherwise call without parameter
        return await callback(tx);
      } finally {
        // Clear context after transaction
        this.transactionContext.clearTransaction();
      }
    });
  }

  /**
   * Simple transaction wrapper for backwards compatibility
   * @deprecated Use executeInTransaction with transaction client parameter instead
   */
  async executeInTransactionSimple<T>(callback: () => Promise<T>): Promise<T> {
    return await this.prisma.$transaction(async tx => {
      // Set transaction context for repositories
      this.transactionContext.setTransactionClient(tx);
      try {
        return await callback();
      } finally {
        // Clear context after transaction
        this.transactionContext.clearTransaction();
      }
    });
  }
}
