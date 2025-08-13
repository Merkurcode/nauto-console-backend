import { StorageTiers } from '../entities/storage-tiers.entity';

/**
 * Storage tiers repository interface
 *
 * Implementations:
 * - {@link StorageTiers} - Production Prisma/PostgreSQL implementation
 */
export interface IStorageTiersRepository {
  findById(id: string): Promise<StorageTiers | null>;
  findByLevel(level: string): Promise<StorageTiers | null>;
  findAll(): Promise<StorageTiers[]>;
  findActive(): Promise<StorageTiers[]>;
  save(storageTier: StorageTiers): Promise<StorageTiers>;
  update(storageTier: StorageTiers): Promise<StorageTiers>;
  delete(id: string): Promise<void>;
}
