import { IQuery, IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Injectable, Inject } from '@nestjs/common';
import {
  IAuditLogRepository,
  IAuditLogQuery,
  IAuditLogQueryResult,
} from '@core/repositories/audit-log.repository.interface';
import { AUDIT_LOG_REPOSITORY } from '@shared/constants/tokens';

export class GetAuditLogsQuery implements IQuery {
  constructor(public readonly query: IAuditLogQuery) {}
}

@Injectable()
@QueryHandler(GetAuditLogsQuery)
export class GetAuditLogsQueryHandler implements IQueryHandler<GetAuditLogsQuery> {
  constructor(
    @Inject(AUDIT_LOG_REPOSITORY)
    private readonly auditLogRepository: IAuditLogRepository,
  ) {}

  async execute(query: GetAuditLogsQuery): Promise<IAuditLogQueryResult> {
    return this.auditLogRepository.query(query.query);
  }
}
