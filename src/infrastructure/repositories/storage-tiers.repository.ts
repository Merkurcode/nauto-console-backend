import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma/prisma.service';
import { TransactionContextService } from '../database/prisma/transaction-context.service';
import { IStorageTiersRepository } from '@core/repositories/storage-tiers.repository.interface';
import { StorageTiers } from '@core/entities/storage-tiers.entity';
import { BaseRepository } from './base.repository';
import { StorageTiersMapper } from '@application/mappers/storage-tiers.mapper';

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

@Injectable()
export class StorageTiersRepository
  extends BaseRepository<StorageTiers>
  implements IStorageTiersRepository
{
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactionContext: TransactionContextService,
  ) {
    super();
  }

  private get client() {
    return this.transactionContext.getTransactionClient() || this.prisma;
  }

  async findById(id: string): Promise<StorageTiers | null> {
    const tierData = await this.client.storageTiers.findUnique({
      where: { id },
    });

    return tierData ? StorageTiersMapper.toEntity(tierData) : null;
  }

  async findByLevel(level: string): Promise<StorageTiers | null> {
    const tierData = await this.client.storageTiers.findUnique({
      where: { level },
    });

    return tierData ? StorageTiersMapper.toEntity(tierData) : null;
  }

  async findAll(): Promise<StorageTiers[]> {
    const tiers = await this.client.storageTiers.findMany({
      orderBy: { level: 'asc' },
    });

    return tiers.map(tier => StorageTiersMapper.toEntity(tier));
  }

  async findActive(): Promise<StorageTiers[]> {
    const tiers = await this.client.storageTiers.findMany({
      where: { isActive: true },
      orderBy: { level: 'asc' },
    });

    return tiers.map(tier => StorageTiersMapper.toEntity(tier));
  }

  async save(storageTier: StorageTiers): Promise<StorageTiers> {
    const persistenceData = StorageTiersMapper.toPersistence(storageTier);
    const tierData = await this.client.storageTiers.create({
      data: {
        ...persistenceData,
        id: storageTier.id,
      },
    });

    return StorageTiersMapper.toEntity(tierData);
  }

  async update(storageTier: StorageTiers): Promise<StorageTiers> {
    const persistenceData = StorageTiersMapper.toPersistence(storageTier);
    const tierData = await this.client.storageTiers.update({
      where: { id: storageTier.id },
      data: {
        ...persistenceData,
        updatedAt: storageTier.updatedAt,
      },
    });

    return StorageTiersMapper.toEntity(tierData);
  }

  async delete(id: string): Promise<void> {
    await this.client.storageTiers.delete({
      where: { id },
    });
  }
}
