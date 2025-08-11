import { IQuery, QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { UserActivityLogService } from '@core/services/user-activity-log.service';
import { UserActivityLogMapper } from '@application/mappers/user-activity-log.mapper';
import { IUserActivityLogPaginatedResponse } from '@application/dtos/_responses/user-activity-log/user-activity-log.response.interface';
import { GetUserActivityLogsDto } from '@application/dtos/user-activity-log/get-user-activity-logs.dto';
import { IUserActivityLogFilters } from '@core/repositories/user-activity-log.repository.interface';
import { UserActivityLogAccessType } from '@shared/constants/user-activity-log-access-type.enum';

export class GetUserActivityLogsQuery implements IQuery {
  constructor(
    public readonly currentUserId: string,
    public readonly targetUserId: string,
    public readonly accessType: UserActivityLogAccessType,
    public readonly filters: GetUserActivityLogsDto,
  ) {}
}

@Injectable()
@QueryHandler(GetUserActivityLogsQuery)
export class GetUserActivityLogsQueryHandler implements IQueryHandler<GetUserActivityLogsQuery> {
  constructor(private readonly userActivityLogService: UserActivityLogService) {}

  async execute(query: GetUserActivityLogsQuery): Promise<IUserActivityLogPaginatedResponse> {
    const { currentUserId, targetUserId, accessType, filters } = query;

    // Build repository filters
    const repositoryFilters: IUserActivityLogFilters = {
      activityType: filters.activityType,
      impact: filters.impact,
      action: filters.action,
      fromDate: filters.fromDate ? new Date(filters.fromDate) : undefined,
      toDate: filters.toDate ? new Date(filters.toDate) : undefined,
      limit: filters.limit,
      offset: filters.offset,
    };

    // Delegate to service for validation and data retrieval
    const { logs: userActivityLogs, total } =
      await this.userActivityLogService.validateAndGetActivityLogs(
        currentUserId,
        targetUserId,
        accessType,
        repositoryFilters,
      );

    return UserActivityLogMapper.toPaginatedResponse(
      userActivityLogs,
      total,
      filters.page || 1,
      filters.limit || 20,
    );
  }
}
