import { Injectable, Inject } from '@nestjs/common';
import { IUserStorageConfigRepository } from '@core/repositories/user-storage-config.repository.interface';
import { USER_STORAGE_CONFIG_REPOSITORY } from '@shared/constants/tokens';
import { UserStorageConfig } from '@core/entities/user-storage-config.entity';
import { UserId } from '@core/value-objects/user-id.vo';
import {
  EntityNotFoundException,
  EntityAlreadyExistsException,
} from '@core/exceptions/domain-exceptions';

@Injectable()
export class UserStorageConfigService {
  constructor(
    @Inject(USER_STORAGE_CONFIG_REPOSITORY)
    private readonly userStorageConfigRepository: IUserStorageConfigRepository,
  ) {}

  async getUserStorageConfigByUserId(userId: string): Promise<UserStorageConfig | null> {
    const userIdVO = UserId.fromString(userId);

    return await this.userStorageConfigRepository.findByUserId(userIdVO);
  }

  async getUserStorageConfigByUserIdOrThrow(userId: string): Promise<UserStorageConfig> {
    const config = await this.getUserStorageConfigByUserId(userId);
    if (!config) {
      throw new EntityNotFoundException('UserStorageConfig', userId);
    }

    return config;
  }

  async createUserStorageConfig(
    userId: string,
    storageTierId: string,
    allowedFileConfig?: Record<string, string[]>,
  ): Promise<UserStorageConfig> {
    const userIdVO = UserId.fromString(userId);

    // Check if config already exists
    const existingConfig = await this.userStorageConfigRepository.findByUserId(userIdVO);
    if (existingConfig) {
      throw new EntityAlreadyExistsException('UserStorageConfig', 'userId');
    }

    const userStorageConfig = UserStorageConfig.create(userIdVO, storageTierId, allowedFileConfig);

    return await this.userStorageConfigRepository.save(userStorageConfig);
  }

  async updateUserStorageConfig(
    userId: string,
    updates: {
      storageTierId?: string;
      allowedFileConfig?: Record<string, string[]>;
    },
  ): Promise<UserStorageConfig> {
    const config = await this.getUserStorageConfigByUserIdOrThrow(userId);

    if (updates.storageTierId && updates.storageTierId !== config.storageTierId) {
      config.updateStorageTier(updates.storageTierId);
    }

    if (updates.allowedFileConfig) {
      config.updateAllowedFileConfig(updates.allowedFileConfig);
    }

    return await this.userStorageConfigRepository.update(config);
  }

  async deleteUserStorageConfig(userId: string): Promise<void> {
    const config = await this.getUserStorageConfigByUserIdOrThrow(userId);
    await this.userStorageConfigRepository.delete(config.id);
  }

  async getAllUserStorageConfigs(): Promise<UserStorageConfig[]> {
    // This method would need to be implemented in the repository
    // For now, throwing an error to indicate it needs implementation
    throw new Error('Method not implemented - repository needs findAll method');
  }

  async getUserStorageConfigsByCompany(_companyId: string): Promise<UserStorageConfig[]> {
    // This method would need to be implemented in the repository
    // For now, throwing an error to indicate it needs implementation
    throw new Error('Method not implemented - repository needs findByCompanyId method');
  }

  // Helper methods for FileUploadLimitGuard
  async getUserActiveFileCount(_userId: string): Promise<number> {
    // This would be implemented in the service that knows about files
    // For now, we'll keep this logic in the guard
    throw new Error('Method not implemented - use StorageService for file operations');
  }

  async validateUserCanUpload(userId: string, fileCount: number = 1): Promise<boolean> {
    const config = await this.getUserStorageConfigByUserIdOrThrow(userId);

    if (!config.storageTier) {
      throw new Error('Storage tier not loaded');
    }

    return config.canUploadFiles(fileCount);
  }
}
