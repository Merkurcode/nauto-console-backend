import { UserStorageConfig } from '@core/entities/user-storage-config.entity';
import { UserId } from '@core/value-objects/user-id.vo';

/**
 * User Storage Config repository interface
 *
 * This interface defines the contract for user storage configuration
 * persistence operations, including tier information and file restrictions.
 *
 * Implementations:
 * - Production: Prisma/PostgreSQL implementation in infrastructure layer
 */
export interface IUserStorageConfigRepository {
  // Basic CRUD operations
  findById(id: string): Promise<UserStorageConfig | null>;
  findByUserId(userId: UserId): Promise<UserStorageConfig | null>;
  findByUserIdWithTier(userId: UserId): Promise<UserStorageConfig | null>;
  findAll(): Promise<UserStorageConfig[]>;
  findByCompanyId(companyId: string): Promise<UserStorageConfig[]>;
  save(userStorageConfig: UserStorageConfig): Promise<UserStorageConfig>;
  update(userStorageConfig: UserStorageConfig): Promise<UserStorageConfig>;
  delete(id: string): Promise<void>;
  exists(userId: UserId): Promise<boolean>;

  // Storage tier operations
  getUserTierInfo(userId: UserId): Promise<{
    maxStorageBytes: bigint;
    maxSimultaneousFiles: number;
    allowedFileConfig: Record<string, string[]>;
    tierName: string;
    tierLevel: string;
  } | null>;

  // Bulk operations
  findByStorageTierId(storageTierId: string): Promise<UserStorageConfig[]>;
  updateStorageTierForUsers(userIds: UserId[], newStorageTierId: string): Promise<number>;

  // Query operations
  getUsersWithoutStorageConfig(): Promise<string[]>;
  countUsersByTier(storageTierId: string): Promise<number>;
}
