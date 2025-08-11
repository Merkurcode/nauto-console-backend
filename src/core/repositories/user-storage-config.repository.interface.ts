import { UserStorageConfig } from '@core/entities/user-storage-config.entity';
import { UserId } from '@core/value-objects/user-id.vo';

export interface IUserStorageConfigRepository {
  findById(id: string): Promise<UserStorageConfig | null>;
  findByUserId(userId: UserId): Promise<UserStorageConfig | null>;
  save(userStorageConfig: UserStorageConfig): Promise<UserStorageConfig>;
  update(userStorageConfig: UserStorageConfig): Promise<UserStorageConfig>;
  delete(id: string): Promise<void>;
  exists(userId: UserId): Promise<boolean>;
}
