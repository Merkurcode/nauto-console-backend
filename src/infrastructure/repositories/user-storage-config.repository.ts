import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '@infrastructure/database/prisma/prisma.service';
import { TransactionContextService } from '@infrastructure/database/prisma/transaction-context.service';
import { IUserStorageConfigRepository } from '@core/repositories/user-storage-config.repository.interface';
import { UserStorageConfig } from '@core/entities/user-storage-config.entity';
import { UserId } from '@core/value-objects/user-id.vo';
import { UserStorageConfigMapper } from '@application/mappers/user-storage-config.mapper';

@Injectable()
export class UserStorageConfigRepository implements IUserStorageConfigRepository {
  private readonly logger = new Logger(UserStorageConfigRepository.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly transactionContext: TransactionContextService,
  ) {}

  private get client() {
    return this.transactionContext.getTransactionClient() || this.prisma;
  }

  async findById(id: string): Promise<UserStorageConfig | null> {
    try {
      const userStorageConfig = await this.client.userStorageConfig.findUnique({
        where: { id },
        include: { storageTier: true },
      });

      return userStorageConfig ? UserStorageConfigMapper.toDomain(userStorageConfig) : null;
    } catch (error) {
      this.logger.error(`Error finding UserStorageConfig by id ${id}:`, error);
      throw error;
    }
  }

  async findByUserId(userId: UserId): Promise<UserStorageConfig | null> {
    try {
      const userStorageConfig = await this.client.userStorageConfig.findUnique({
        where: { userId: userId.getValue() },
        include: { storageTier: true },
      });

      return userStorageConfig ? UserStorageConfigMapper.toDomain(userStorageConfig) : null;
    } catch (error) {
      this.logger.error(`Error finding UserStorageConfig by userId ${userId.getValue()}:`, error);
      throw error;
    }
  }

  async save(userStorageConfig: UserStorageConfig): Promise<UserStorageConfig> {
    try {
      const data = this.toPersistence(userStorageConfig);

      const savedUserStorageConfig = await this.client.userStorageConfig.create({
        data,
        include: { storageTier: true },
      });

      this.logger.debug(`UserStorageConfig created with id: ${savedUserStorageConfig.id}`);

      return UserStorageConfigMapper.toDomain(savedUserStorageConfig);
    } catch (error) {
      this.logger.error(`Error saving UserStorageConfig:`, error);
      throw error;
    }
  }

  async update(userStorageConfig: UserStorageConfig): Promise<UserStorageConfig> {
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

      this.logger.debug(`UserStorageConfig updated with id: ${updatedUserStorageConfig.id}`);

      return UserStorageConfigMapper.toDomain(updatedUserStorageConfig);
    } catch (error) {
      this.logger.error(`Error updating UserStorageConfig with id ${userStorageConfig.id}:`, error);
      throw error;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.client.userStorageConfig.delete({
        where: { id },
      });

      this.logger.debug(`UserStorageConfig deleted with id: ${id}`);
    } catch (error) {
      this.logger.error(`Error deleting UserStorageConfig with id ${id}:`, error);
      throw error;
    }
  }

  async exists(userId: UserId): Promise<boolean> {
    try {
      const count = await this.client.userStorageConfig.count({
        where: { userId: userId.getValue() },
      });

      return count > 0;
    } catch (error) {
      this.logger.error(
        `Error checking UserStorageConfig existence for userId ${userId.getValue()}:`,
        error,
      );
      throw error;
    }
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
