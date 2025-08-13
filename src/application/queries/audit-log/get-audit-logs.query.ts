import { IQuery, IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { AuditLogService } from '@core/services/audit-log.service';
import { AuditLogQueryDto } from '@application/dtos/audit-log/audit-log-query.dto';
import { AuditLogQueryMapper } from '@application/mappers/audit-log-query.mapper';
import { IAuditLogQueryResponse } from '@application/dtos/_responses/audit-log/audit-log-query.response.interface';

export class GetAuditLogsQuery implements IQuery {
  constructor(public readonly queryDto: AuditLogQueryDto) {}
}

@Injectable()
@QueryHandler(GetAuditLogsQuery)
export class GetAuditLogsQueryHandler implements IQueryHandler<GetAuditLogsQuery> {
  constructor(private readonly auditLogService: AuditLogService) {}

  async execute(query: GetAuditLogsQuery): Promise<IAuditLogQueryResponse> {
    const domainQuery = AuditLogQueryMapper.toDomain(query.queryDto);
    const result = await this.auditLogService.queryLogs(domainQuery);

    return AuditLogQueryMapper.toResponse(result);
  }
}
