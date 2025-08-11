import { Injectable, Inject, Optional } from '@nestjs/common';
import { PrismaService } from '@infrastructure/database/prisma/prisma.service';
import { TransactionContextService } from '@infrastructure/database/prisma/transaction-context.service';
import { IUserStorageConfigRepository } from '@core/repositories/user-storage-config.repository.interface';
import { UserStorageConfig } from '@core/entities/user-storage-config.entity';
import { UserId } from '@core/value-objects/user-id.vo';
import { UserStorageConfigMapper } from '@application/mappers/user-storage-config.mapper';
import { BaseRepository } from './base.repository';
import { LOGGER_SERVICE } from '@shared/constants/tokens';
import { ILogger } from '@core/interfaces/logger.interface';

@Injectable()
export class UserStorageConfigRepository
  extends BaseRepository<UserStorageConfig>
  implements IUserStorageConfigRepository
{
  constructor(
    private readonly prisma: PrismaService,
    private readonly transactionContext: TransactionContextService,
    @Optional() @Inject(LOGGER_SERVICE) logger?: ILogger,
  ) {
    super(logger);
  }

  private get client() {
    return this.transactionContext.getTransactionClient() || this.prisma;
  }

  async findById(id: string): Promise<UserStorageConfig | null> {
    return this.executeWithErrorHandling('findById', async () => {
      try {
        const userStorageConfig = await this.client.userStorageConfig.findUnique({
          where: { id },
          include: { storageTier: true },
        });

        return userStorageConfig ? UserStorageConfigMapper.toDomain(userStorageConfig) : null;
      } catch (error) {
        throw error;
      }
    });
  }

  async findByUserId(userId: UserId): Promise<UserStorageConfig | null> {
    return this.executeWithErrorHandling('findByUserId', async () => {
      try {
        const userStorageConfig = await this.client.userStorageConfig.findUnique({
          where: { userId: userId.getValue() },
          include: { storageTier: true },
        });

        return userStorageConfig ? UserStorageConfigMapper.toDomain(userStorageConfig) : null;
      } catch (error) {
        throw error;
      }
    });
  }

  async save(userStorageConfig: UserStorageConfig): Promise<UserStorageConfig> {
    return this.executeWithErrorHandling('save', async () => {
      try {
        const data = this.toPersistence(userStorageConfig);

        const savedUserStorageConfig = await this.client.userStorageConfig.create({
          data,
          include: { storageTier: true },
        });

        return UserStorageConfigMapper.toDomain(savedUserStorageConfig);
      } catch (error) {
        throw error;
      }
    });
  }

  async update(userStorageConfig: UserStorageConfig): Promise<UserStorageConfig> {
    return this.executeWithErrorHandling('update', async () => {
      try {
        const data = this.toPersistence(userStorageConfig);

        const updatedUserStorageConfig = await this.client.userStorageConfig.update({
          where: { id: userStorageConfig.id },
          data: {
            storageTierId: data.storageTierId,
            allowedFileConfig: data.allowedFileConfig,
            updatedAt: data.updatedAt,
          },
          include: { storageTier: true },
        });

        return UserStorageConfigMapper.toDomain(updatedUserStorageConfig);
      } catch (error) {
        throw error;
      }
    });
  }

  async delete(id: string): Promise<void> {
    return this.executeWithErrorHandling('delete', async () => {
      try {
        await this.client.userStorageConfig.delete({
          where: { id },
        });
      } catch (error) {
        throw error;
      }
    });
  }

  async exists(userId: UserId): Promise<boolean> {
    return this.executeWithErrorHandling('exists', async () => {
      try {
        const count = await this.client.userStorageConfig.count({
          where: { userId: userId.getValue() },
        });

        return count > 0;
      } catch (error) {
        throw error;
      }
    });
  }

  private toPersistence(userStorageConfig: UserStorageConfig) {
    return {
      id: userStorageConfig.id,
      userId: userStorageConfig.userId.getValue(),
      storageTierId: userStorageConfig.storageTierId,
      allowedFileConfig: userStorageConfig.allowedFileConfig,
      createdAt: userStorageConfig.createdAt,
      updatedAt: userStorageConfig.updatedAt,
    };
  }
}
