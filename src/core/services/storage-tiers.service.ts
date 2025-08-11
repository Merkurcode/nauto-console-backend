import { Injectable, Inject } from '@nestjs/common';
import { IStorageTiersRepository } from '@core/repositories/storage-tiers.repository.interface';
import { STORAGE_TIERS_REPOSITORY } from '@shared/constants/tokens';
import { StorageTiers } from '@core/entities/storage-tiers.entity';
import { StorageBytes } from '@core/value-objects/storage-bytes.vo';
import { MaxSimultaneousFiles } from '@core/value-objects/max-simultaneous-files.vo';
import {
  EntityNotFoundException,
  EntityAlreadyExistsException,
} from '@core/exceptions/domain-exceptions';

@Injectable()
export class StorageTiersService {
  constructor(
    @Inject(STORAGE_TIERS_REPOSITORY)
    private readonly storageTiersRepository: IStorageTiersRepository,
  ) {}

  async getStorageTierById(id: string): Promise<StorageTiers | null> {
    return await this.storageTiersRepository.findById(id);
  }

  async getStorageTierByIdOrThrow(id: string): Promise<StorageTiers> {
    const tier = await this.getStorageTierById(id);
    if (!tier) {
      throw new EntityNotFoundException('StorageTier', id);
    }

    return tier;
  }

  async getStorageTierByLevel(level: string): Promise<StorageTiers | null> {
    return await this.storageTiersRepository.findByLevel(level);
  }

  async getStorageTierByLevelOrThrow(level: string): Promise<StorageTiers> {
    const tier = await this.getStorageTierByLevel(level);
    if (!tier) {
      throw new EntityNotFoundException('StorageTier', `level ${level}`);
    }

    return tier;
  }

  async getAllStorageTiers(): Promise<StorageTiers[]> {
    return await this.storageTiersRepository.findAll();
  }

  async getActiveStorageTiers(): Promise<StorageTiers[]> {
    return await this.storageTiersRepository.findActive();
  }

  async createStorageTier(
    name: string,
    level: string,
    maxStorageBytes: bigint,
    maxSimultaneousFiles: number,
    isActive: boolean = true,
  ): Promise<StorageTiers> {
    // Check if tier with same level already exists
    const existingTier = await this.storageTiersRepository.findByLevel(level);
    if (existingTier) {
      throw new EntityAlreadyExistsException('StorageTier', 'level');
    }

    const storageBytesVO = StorageBytes.fromBytes(maxStorageBytes);
    const storageTier = StorageTiers.create(
      name,
      level,
      storageBytesVO,
      maxSimultaneousFiles,
      isActive,
    );

    return await this.storageTiersRepository.save(storageTier);
  }

  async updateStorageTier(
    id: string,
    updates: {
      name?: string;
      level?: string;
      maxStorageBytes?: bigint;
      maxSimultaneousFiles?: number;
      isActive?: boolean;
    },
  ): Promise<StorageTiers> {
    const tier = await this.getStorageTierByIdOrThrow(id);

    if (updates.name !== undefined) {
      tier.updateName(updates.name);
    }

    if (updates.level !== undefined && updates.level !== tier.level) {
      // Check if new level is already taken
      const existingTier = await this.storageTiersRepository.findByLevel(updates.level);
      if (existingTier && existingTier.id !== tier.id) {
        throw new EntityAlreadyExistsException('StorageTier', 'level');
      }
      tier.updateLevel(updates.level);
    }

    if (updates.maxStorageBytes !== undefined) {
      const storageBytesVO = StorageBytes.fromBytes(updates.maxStorageBytes);
      tier.updateMaxStorage(storageBytesVO);
    }

    if (updates.maxSimultaneousFiles !== undefined) {
      const maxSimultaneousFilesVO = MaxSimultaneousFiles.create(updates.maxSimultaneousFiles);
      tier.updateMaxSimultaneousFiles(maxSimultaneousFilesVO);
    }

    if (updates.isActive !== undefined) {
      if (updates.isActive) {
        tier.activate();
      } else {
        tier.deactivate();
      }
    }

    return await this.storageTiersRepository.update(tier);
  }

  async deleteStorageTier(id: string): Promise<void> {
    const tier = await this.getStorageTierByIdOrThrow(id);
    await this.storageTiersRepository.delete(tier.id);
  }

  async activateStorageTier(id: string): Promise<StorageTiers> {
    const tier = await this.getStorageTierByIdOrThrow(id);
    tier.activate();

    return await this.storageTiersRepository.update(tier);
  }

  async deactivateStorageTier(id: string): Promise<StorageTiers> {
    const tier = await this.getStorageTierByIdOrThrow(id);
    tier.deactivate();

    return await this.storageTiersRepository.update(tier);
  }
}
