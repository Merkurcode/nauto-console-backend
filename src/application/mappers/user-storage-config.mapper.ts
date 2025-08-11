import { StorageTiers } from '@core/entities/storage-tiers.entity';
import { UserStorageConfig, IAllowedFileConfig } from '@core/entities/user-storage-config.entity';
import { MaxSimultaneousFiles } from '@core/value-objects/max-simultaneous-files.vo';
import { StorageBytes } from '@core/value-objects/storage-bytes.vo';
import { UserId } from '@core/value-objects/user-id.vo';

export interface IUserStorageConfigResponse {
  id: string;
  userId: string;
  storageTierId: string;
  storageTierName?: string; // From relation
  maxStorageBytes?: string; // From tier
  maxStorageBytesBigInt?: bigint; // From tier
  maxStorageMB?: number; // From tier
  maxSimultaneousFiles?: number; // From tier
  allowedFileConfig: IAllowedFileConfig;
  allowedExtensions: string[];
  allowedMimeTypes: string[];
  createdAt: Date;
  updatedAt: Date;
}

export class UserStorageConfigMapper {
  static toResponse(userStorageConfig: UserStorageConfig): IUserStorageConfigResponse {
    const baseResponse = {
      id: userStorageConfig.id,
      userId: userStorageConfig.userId.getValue(),
      storageTierId: userStorageConfig.storageTierId,
      allowedFileConfig: userStorageConfig.allowedFileConfig,
      allowedExtensions: userStorageConfig.getAllowedExtensions(),
      allowedMimeTypes: userStorageConfig.getAllowedMimeTypes(),
      createdAt: userStorageConfig.createdAt,
      updatedAt: userStorageConfig.updatedAt,
    };

    // Add tier information if storage tier is loaded
    if (userStorageConfig.storageTier) {
      return {
        ...baseResponse,
        storageTierName: userStorageConfig.storageTier.name,
        maxStorageBytes: userStorageConfig.maxStorageBytes.toString(),
        maxStorageBytesBigInt: userStorageConfig.maxStorageBytes,
        maxStorageMB: userStorageConfig.getMaxStorageInMB(),
        maxSimultaneousFiles: userStorageConfig.maxSimultaneousFiles,
      };
    }

    return baseResponse;
  }

  static toResponseArray(configs: UserStorageConfig[]): IUserStorageConfigResponse[] {
    return configs.map(config => UserStorageConfigMapper.toResponse(config));
  }

  static toDomain(data: unknown): UserStorageConfig {
    const record = data as {
      id: string;
      userId: string;
      storageTierId: string;
      allowedFileConfig: IAllowedFileConfig;
      createdAt: Date;
      updatedAt: Date;
      storageTier?: {
        id: string;
        name: string;
        level: string;
        maxStorageBytes: bigint;
        maxSimultaneousFiles: number;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
      };
    };

    const config = new UserStorageConfig(
      record.id,
      UserId.fromString(record.userId),
      record.storageTierId,
      record.allowedFileConfig,
      record.createdAt,
      record.updatedAt,
    );

    // Set storage tier if provided in relation
    if (record.storageTier) {
      const storageTier = new StorageTiers(
        record.storageTier.id,
        record.storageTier.name,
        record.storageTier.level,
        StorageBytes.fromBytes(record.storageTier.maxStorageBytes),
        MaxSimultaneousFiles.create(
          record.storageTier.maxSimultaneousFiles,
          Number.MAX_SAFE_INTEGER,
        ),
        record.storageTier.isActive,
        record.storageTier.createdAt,
        record.storageTier.updatedAt,
      );
      config.setStorageTier(storageTier);
    }

    return config;
  }
}
