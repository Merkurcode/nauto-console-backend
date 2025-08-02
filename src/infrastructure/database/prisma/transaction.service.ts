import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { Prisma } from '@prisma/client';

export type TransactionClient = Prisma.TransactionClient;

@Injectable()
export class TransactionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Execute a function within a database transaction
   * If any error occurs, the transaction is automatically rolled back
   * @param callback Function to execute within the transaction, receives transaction client
   * @returns Promise with the result of the callback
   */
  async executeInTransaction<T>(callback: (tx: TransactionClient) => Promise<T>): Promise<T> {
    return await this.prisma.$transaction(async tx => {
      return await callback(tx);
    });
  }

  /**
   * Simple transaction wrapper for backwards compatibility
   * @deprecated Use executeInTransaction with transaction client parameter instead
   */
  async executeInTransactionSimple<T>(callback: () => Promise<T>): Promise<T> {
    return await this.prisma.$transaction(async () => {
      return await callback();
    });
  }
}
