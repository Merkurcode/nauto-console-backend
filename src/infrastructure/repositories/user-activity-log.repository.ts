import { Injectable } from '@nestjs/common';
import { PrismaService } from '@infrastructure/database/prisma/prisma.service';
import { UserActivityLog } from '@core/entities/user-activity-log.entity';
import {
  IUserActivityLogRepository,
  IUserActivityLogFilters,
} from '@core/repositories/user-activity-log.repository.interface';
import { UserId } from '@core/value-objects/user-id.vo';
import { UserActivityLogMapper } from '@application/mappers/user-activity-log.mapper';
import { Prisma } from '@prisma/client';

interface IWhereClause extends Record<string, unknown> {
  timestamp?: {
    gte?: Date;
    lte?: Date;
  };
}

@Injectable()
export class UserActivityLogRepository implements IUserActivityLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(userActivityLog: UserActivityLog): Promise<UserActivityLog> {
    const data = UserActivityLogMapper.toPersistence(userActivityLog);

    const saved = await this.prisma.userActivityLog.upsert({
      where: { id: userActivityLog.id },
      update: data as Prisma.UserActivityLogUncheckedUpdateInput,
      create: data as Prisma.UserActivityLogUncheckedCreateInput,
    });

    return UserActivityLogMapper.toDomain(saved);
  }

  async findById(id: string): Promise<UserActivityLog | null> {
    const userActivityLog = await this.prisma.userActivityLog.findUnique({
      where: { id },
    });

    if (!userActivityLog) {
      return null;
    }

    return UserActivityLogMapper.toDomain(userActivityLog);
  }

  async findByUserId(
    userId: UserId,
    filters?: IUserActivityLogFilters,
  ): Promise<UserActivityLog[]> {
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
  }

  async findAll(filters?: IUserActivityLogFilters): Promise<UserActivityLog[]> {
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
  }

  async countByUserId(
    userId: UserId,
    filters?: Omit<IUserActivityLogFilters, 'limit' | 'offset'>,
  ): Promise<number> {
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
  }

  async countAll(filters?: Omit<IUserActivityLogFilters, 'limit' | 'offset'>): Promise<number> {
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
  }

  async deleteByUserId(userId: UserId): Promise<void> {
    await this.prisma.userActivityLog.deleteMany({
      where: {
        userId: userId.getValue(),
      },
    });
  }
}
