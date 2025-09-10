import { Injectable, Inject } from '@nestjs/common';
import { IUserStorageConfigRepository } from '@core/repositories/user-storage-config.repository.interface';
import { USER_STORAGE_CONFIG_REPOSITORY } from '@shared/constants/tokens';
import { UserStorageConfig, IAllowedFileConfig } from '@core/entities/user-storage-config.entity';
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
    allowedFileConfig?: IAllowedFileConfig,
  ): Promise<UserStorageConfig> {
    const userIdVO = UserId.fromString(userId);

    // Check if config already exists
    const existingConfig = await this.userStorageConfigRepository.findByUserId(userIdVO);
    if (existingConfig) {
      throw new EntityAlreadyExistsException('UserStorageConfig', 'userId');
    }

    // If no allowedFileConfig provided, get it from the tier
    const finalAllowedFileConfig = allowedFileConfig;
    if (!finalAllowedFileConfig) {
      // TODO: Get default config from the tier itself
      // For now, we'll require it to be passed explicitly
      throw new Error(
        'allowedFileConfig must be provided - it should come from the tier configuration',
      );
    }

    const userStorageConfig = UserStorageConfig.create(
      userIdVO,
      storageTierId,
      finalAllowedFileConfig,
    );

    return await this.userStorageConfigRepository.save(userStorageConfig);
  }

  async updateUserStorageConfig(
    userId: string,
    updates: {
      storageTierId?: string;
      allowedFileConfig?: IAllowedFileConfig;
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
    return await this.userStorageConfigRepository.findAll();
  }

  async getUserStorageConfig(
    userId: string,
    useCache?: boolean,
  ): Promise<UserStorageConfig | null> {
    return await this.userStorageConfigRepository.findByUserId(UserId.fromString(userId), useCache);
  }

  async getUserStorageConfigsByCompany(companyId: string): Promise<UserStorageConfig[]> {
    return await this.userStorageConfigRepository.findByCompanyId(companyId);
  }

  async validateUserCanUpload(userId: string, fileCount: number = 1): Promise<boolean> {
    const config = await this.getUserStorageConfigByUserIdOrThrow(userId);

    if (!config.storageTier) {
      throw new Error('Storage tier not loaded');
    }

    return config.canUploadFiles(fileCount);
  }

  async clearCache(userId?: string): Promise<void> {
    await this.userStorageConfigRepository.clearCache(
      userId ? UserId.fromString(userId) : undefined,
    );
  }
}
