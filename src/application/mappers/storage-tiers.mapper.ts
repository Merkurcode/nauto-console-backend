import { Injectable } from '@nestjs/common';
import { StorageTiers } from '@core/entities/storage-tiers.entity';
import { StorageBytes } from '@core/value-objects/storage-bytes.vo';
import { MaxSimultaneousFiles } from '@core/value-objects/max-simultaneous-files.vo';

/**
 * Interface representing storage tier data from storage
 */
export interface IStorageTierData {
  id: string;
  name: string;
  level: string;
  maxStorageBytes: bigint;
  maxSimultaneousFiles: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Storage Tiers Mapper
 * Maps between StorageTiers entity and database representation
 */
@Injectable()
export class StorageTiersMapper {
  static toEntity(data: IStorageTierData): StorageTiers {
    const maxStorageBytes = StorageBytes.fromBytes(data.maxStorageBytes);
    const maxSimultaneousFiles = MaxSimultaneousFiles.create(data.maxSimultaneousFiles);

    return new StorageTiers(
      data.id,
      data.name,
      data.level,
      maxStorageBytes,
      maxSimultaneousFiles,
      data.isActive,
      data.createdAt,
      data.updatedAt,
    );
  }

  static toPersistence(
    entity: StorageTiers,
  ): Omit<IStorageTierData, 'id' | 'createdAt' | 'updatedAt'> {
    return {
      name: entity.name,
      level: entity.level,
      maxStorageBytes: entity.maxStorageBytes.getValue(),
      maxSimultaneousFiles: entity.maxSimultaneousFiles.getValue(),
      isActive: entity.isActive,
    };
  }
}
