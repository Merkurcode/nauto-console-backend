import { IQuery, IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Injectable, Inject } from '@nestjs/common';
import { IAuditLogRepository } from '@core/repositories/audit-log.repository.interface';
import { AUDIT_LOG_REPOSITORY } from '@shared/constants/tokens';
import { AuditLogQueryDto } from '@application/dtos/audit-log/audit-log-query.dto';
import { AuditLogQueryMapper } from '@application/mappers/audit-log-query.mapper';
import { IAuditLogQueryResponse } from '@application/dtos/_responses/audit-log/audit-log-query.response.interface';

export class GetAuditLogsQuery implements IQuery {
  constructor(public readonly queryDto: AuditLogQueryDto) {}
}

@Injectable()
@QueryHandler(GetAuditLogsQuery)
export class GetAuditLogsQueryHandler implements IQueryHandler<GetAuditLogsQuery> {
  constructor(
    @Inject(AUDIT_LOG_REPOSITORY)
    private readonly auditLogRepository: IAuditLogRepository,
  ) {}

  async execute(query: GetAuditLogsQuery): Promise<IAuditLogQueryResponse> {
    const domainQuery = AuditLogQueryMapper.toDomain(query.queryDto);
    const result = await this.auditLogRepository.query(domainQuery);

    return AuditLogQueryMapper.toResponse(result);
  }
}
