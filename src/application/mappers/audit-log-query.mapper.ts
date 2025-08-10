import { AuditLogQueryDto } from '@application/dtos/audit-log/audit-log-query.dto';
import {
  IAuditLogQuery,
  IAuditLogQueryResult,
} from '@core/repositories/audit-log.repository.interface';
import { IAuditLogQueryResponse } from '@application/dtos/_responses/audit-log/audit-log-query.response.interface';

export class AuditLogQueryMapper {
  public static toDomain(dto: AuditLogQueryDto): IAuditLogQuery {
    return {
      filters: {
        level: dto.level,
        type: dto.type,
        userId: dto.userId,
        context: dto.context,
        fromDate: dto.fromDate ? new Date(dto.fromDate) : undefined,
        toDate: dto.toDate ? new Date(dto.toDate) : undefined,
        ipAddress: dto.ipAddress,
        userAgent: dto.userAgent,
        sessionId: dto.sessionId,
        resource: dto.resource,
        errorCode: dto.errorCode,
        search: dto.search,
      },
      page: dto.page || 1,
      limit: dto.limit || 50,
      sortBy: dto.sortBy || 'timestamp',
      sortOrder: dto.sortOrder || 'desc',
    };
  }

  public static toResponse(result: IAuditLogQueryResult): IAuditLogQueryResponse {
    return {
      logs: result.logs,
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
  }
}
