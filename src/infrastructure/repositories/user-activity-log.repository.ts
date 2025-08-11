import { Injectable, Inject, Optional } from '@nestjs/common';
import { PrismaService } from '@infrastructure/database/prisma/prisma.service';
import { BaseRepository } from './base.repository';
import { UserActivityLog } from '@core/entities/user-activity-log.entity';
import {
  IUserActivityLogRepository,
  IUserActivityLogFilters,
} from '@core/repositories/user-activity-log.repository.interface';
import { UserId } from '@core/value-objects/user-id.vo';
import { UserActivityLogMapper } from '@application/mappers/user-activity-log.mapper';
import { Prisma } from '@prisma/client';
import { LOGGER_SERVICE } from '@shared/constants/tokens';
import { ILogger } from '@core/interfaces/logger.interface';

interface IWhereClause extends Record<string, unknown> {
  timestamp?: {
    gte?: Date;
    lte?: Date;
  };
}

/**
 * User Activity Log Repository
 * NOTE: Activity logs are persisted outside of transactions by default
 * to ensure they are saved even if the main operation fails.
 */
@Injectable()
export class UserActivityLogRepository
  extends BaseRepository<UserActivityLog>
  implements IUserActivityLogRepository
{
  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject(LOGGER_SERVICE) logger?: ILogger,
  ) {
    super(logger);
  }

  // Activity logs should not use transactions by default
  private get client() {
    return this.prisma;
  }

  async save(userActivityLog: UserActivityLog): Promise<UserActivityLog> {
    return this.executeWithErrorHandling('save', async () => {
      const data = UserActivityLogMapper.toPersistence(userActivityLog);

      const saved = await this.client.userActivityLog.upsert({
        where: { id: userActivityLog.id },
        update: data as Prisma.UserActivityLogUncheckedUpdateInput,
        create: data as Prisma.UserActivityLogUncheckedCreateInput,
      });

      return UserActivityLogMapper.toDomain(saved);
    });
  }

  async findById(id: string): Promise<UserActivityLog | null> {
    return this.executeWithErrorHandling('findById', async () => {
      const userActivityLog = await this.client.userActivityLog.findUnique({
        where: { id },
      });

      if (!userActivityLog) {
        return null;
      }

      return UserActivityLogMapper.toDomain(userActivityLog);
    });
  }

  async findByUserId(
    userId: UserId,
    filters?: IUserActivityLogFilters,
  ): Promise<UserActivityLog[]> {
    return this.executeWithErrorHandling('findByUserId', async () => {
      const where: IWhereClause = {
        userId: userId.getValue(),
      };

      if (filters?.activityType) {
        where.activityType = filters.activityType;
      }

      if (filters?.impact) {
        where.impact = filters.impact;
      }

      if (filters?.action) {
        where.action = {
          contains: filters.action,
          mode: 'insensitive',
        };
      }

      if (filters?.fromDate || filters?.toDate) {
        where.timestamp = {};
        if (filters.fromDate) {
          where.timestamp.gte = filters.fromDate;
        }
        if (filters.toDate) {
          where.timestamp.lte = filters.toDate;
        }
      }

      const userActivityLogs = await this.prisma.userActivityLog.findMany({
        where,
        orderBy: {
          timestamp: 'desc',
        },
        take: filters?.limit,
        skip: filters?.offset,
      });

      return userActivityLogs.map(log => UserActivityLogMapper.toDomain(log));
    });
  }

  async findAll(filters?: IUserActivityLogFilters): Promise<UserActivityLog[]> {
    return this.executeWithErrorHandling('findAll', async () => {
      const where: IWhereClause = {};

      if (filters?.userId) {
        where.userId = filters.userId;
      }

      if (filters?.activityType) {
        where.activityType = filters.activityType;
      }

      if (filters?.impact) {
        where.impact = filters.impact;
      }

      if (filters?.action) {
        where.action = {
          contains: filters.action,
          mode: 'insensitive',
        };
      }

      if (filters?.fromDate || filters?.toDate) {
        where.timestamp = {};
        if (filters.fromDate) {
          where.timestamp.gte = filters.fromDate;
        }
        if (filters.toDate) {
          where.timestamp.lte = filters.toDate;
        }
      }

      const userActivityLogs = await this.prisma.userActivityLog.findMany({
        where,
        orderBy: {
          timestamp: 'desc',
        },
        take: filters?.limit,
        skip: filters?.offset,
      });

      return userActivityLogs.map(log => UserActivityLogMapper.toDomain(log));
    });
  }

  async countByUserId(
    userId: UserId,
    filters?: Omit<IUserActivityLogFilters, 'limit' | 'offset'>,
  ): Promise<number> {
    return this.executeWithErrorHandling('countByUserId', async () => {
      const where: IWhereClause = {
        userId: userId.getValue(),
      };

      if (filters?.activityType) {
        where.activityType = filters.activityType;
      }

      if (filters?.impact) {
        where.impact = filters.impact;
      }

      if (filters?.action) {
        where.action = {
          contains: filters.action,
          mode: 'insensitive',
        };
      }

      if (filters?.fromDate || filters?.toDate) {
        where.timestamp = {};
        if (filters.fromDate) {
          where.timestamp.gte = filters.fromDate;
        }
        if (filters.toDate) {
          where.timestamp.lte = filters.toDate;
        }
      }

      return await this.prisma.userActivityLog.count({
        where,
      });
    });
  }

  async countAll(filters?: Omit<IUserActivityLogFilters, 'limit' | 'offset'>): Promise<number> {
    return this.executeWithErrorHandling('countAll', async () => {
      const where: IWhereClause = {};

      if (filters?.userId) {
        where.userId = filters.userId;
      }

      if (filters?.activityType) {
        where.activityType = filters.activityType;
      }

      if (filters?.impact) {
        where.impact = filters.impact;
      }

      if (filters?.action) {
        where.action = {
          contains: filters.action,
          mode: 'insensitive',
        };
      }

      if (filters?.fromDate || filters?.toDate) {
        where.timestamp = {};
        if (filters.fromDate) {
          where.timestamp.gte = filters.fromDate;
        }
        if (filters.toDate) {
          where.timestamp.lte = filters.toDate;
        }
      }

      return await this.prisma.userActivityLog.count({
        where,
      });
    });
  }

  async deleteByUserId(userId: UserId): Promise<void> {
    return this.executeWithErrorHandling('deleteByUserId', async () => {
      await this.prisma.userActivityLog.deleteMany({
        where: {
          userId: userId.getValue(),
        },
      });
    });
  }
}
