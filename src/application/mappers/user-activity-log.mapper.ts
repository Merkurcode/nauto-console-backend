import { Injectable } from '@nestjs/common';
import { UserActivityLog } from '@core/entities/user-activity-log.entity';
import { UserId } from '@core/value-objects/user-id.vo';
import { UserActivityType } from '@core/value-objects/user-activity-type.vo';
import { UserActivityImpact } from '@core/value-objects/user-activity-impact.vo';
import {
  IUserActivityLogResponse,
  IUserActivityLogPaginatedResponse,
} from '@application/dtos/_responses/user-activity-log/user-activity-log.response.interface';

interface IPrismaUserActivityLog {
  id: string;
  userId: string;
  activityType: string;
  action: string;
  description: string;
  impact: string;
  version: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: string;
  timestamp: Date;
}

@Injectable()
export class UserActivityLogMapper {
  static toDomain(
    prismaUserActivityLog: IPrismaUserActivityLog | Record<string, unknown>,
  ): UserActivityLog {
    const data = prismaUserActivityLog as Record<string, unknown>;
    const props = {
      userId: UserId.fromString(data.userId as string),
      activityType: UserActivityType.create(data.activityType as string),
      action: data.action as string,
      description: data.description as string,
      impact: UserActivityImpact.create(data.impact as string),
      version: (data.version as string) || '1.0.0',
      ipAddress: data.ipAddress as string | undefined,
      userAgent: data.userAgent as string | undefined,
      metadata: data.metadata ? JSON.parse(data.metadata as string) : undefined,
      timestamp: data.timestamp as Date,
    };

    return UserActivityLog.fromPersistence(props, data.id as string);
  }

  static toPersistence(userActivityLog: UserActivityLog): IPrismaUserActivityLog {
    return {
      id: userActivityLog.id,
      userId: userActivityLog.userId.getValue(),
      activityType: userActivityLog.activityType.getValue(),
      action: userActivityLog.action,
      description: userActivityLog.description,
      impact: userActivityLog.impact.getValue(),
      version: userActivityLog.version,
      ipAddress: userActivityLog.ipAddress,
      userAgent: userActivityLog.userAgent,
      metadata: userActivityLog.metadata ? JSON.stringify(userActivityLog.metadata) : undefined,
      timestamp: userActivityLog.timestamp,
    };
  }

  static toResponse(userActivityLog: UserActivityLog): IUserActivityLogResponse {
    return {
      id: userActivityLog.id,
      userId: userActivityLog.userId.getValue(),
      activityType: userActivityLog.activityType.getValue(),
      action: userActivityLog.action,
      description: userActivityLog.description,
      impact: userActivityLog.impact.getValue(),
      version: userActivityLog.version,
      ipAddress: userActivityLog.ipAddress,
      userAgent: userActivityLog.userAgent,
      metadata: userActivityLog.metadata,
      timestamp: userActivityLog.timestamp,
    };
  }

  static toResponseList(userActivityLogs: UserActivityLog[]): IUserActivityLogResponse[] {
    return userActivityLogs.map(log => this.toResponse(log));
  }

  static toPaginatedResponse(
    userActivityLogs: UserActivityLog[],
    total: number,
    page: number,
    limit: number,
  ): IUserActivityLogPaginatedResponse {
    return {
      data: this.toResponseList(userActivityLogs),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
