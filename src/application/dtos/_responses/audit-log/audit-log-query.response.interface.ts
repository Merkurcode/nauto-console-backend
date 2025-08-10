import { AuditLog } from '@core/entities/audit-log.entity';

export interface IAuditLogQueryResponse {
  logs: AuditLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
