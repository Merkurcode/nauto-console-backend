import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import { TransactionClient } from './transaction.service';

// AsyncLocalStorage for transaction context - automatically cleaned up per request
const asyncLocalStorage = new AsyncLocalStorage<TransactionClient>();

@Injectable()
export class TransactionContextService {
  setTransactionClient(client: TransactionClient): void {
    // Store the transaction client in the current async context
    asyncLocalStorage.enterWith(client);
  }

  getTransactionClient(): TransactionClient | null {
    // Retrieve the transaction client from the current async context
    return asyncLocalStorage.getStore() || null;
  }

  hasTransaction(): boolean {
    return asyncLocalStorage.getStore() !== undefined;
  }

  clearTransaction(): void {
    // AsyncLocalStorage automatically cleans up when the async context ends
    // No manual cleanup needed, but we can explicitly exit if needed
    asyncLocalStorage.enterWith(undefined as any);
  }
}
