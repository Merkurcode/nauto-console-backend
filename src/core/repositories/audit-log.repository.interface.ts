import { AuditLog, AuditLogLevel, AuditLogType } from '@core/entities/audit-log.entity';
import { AuditLogId } from '@core/value-objects/audit-log-id.vo';
import { UserId } from '@core/value-objects/user-id.vo';

export interface IAuditLogFilters {
  level?: AuditLogLevel[];
  type?: AuditLogType[];
  userId?: string;
  context?: string[];
  fromDate?: Date;
  toDate?: Date;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  resource?: string;
  errorCode?: string;
  search?: string; // General text search in message and metadata
}

export interface IAuditLogQuery {
  filters?: IAuditLogFilters;
  page?: number;
  limit?: number;
  sortBy?: 'timestamp' | 'level' | 'type' | 'context';
  sortOrder?: 'asc' | 'desc';
}

export interface IAuditLogQueryResult {
  logs: AuditLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Repository interface for audit log persistence
 * Following Clean Architecture - interface in domain layer
 */
export interface IAuditLogRepository {
  /**
   * Save audit log entry
   * @param auditLog The audit log to save
   * @param useTransaction Whether to use transaction context (default: false to ensure persistence)
   */
  save(auditLog: AuditLog, useTransaction?: boolean): Promise<AuditLog>;

  /**
   * Find audit log by ID
   */
  findById(id: AuditLogId): Promise<AuditLog | null>;

  /**
   * Query audit logs with filters and pagination
   */
  query(query: IAuditLogQuery): Promise<IAuditLogQueryResult>;

  /**
   * Find logs by user ID
   */
  findByUserId(userId: UserId, limit?: number): Promise<AuditLog[]>;

  /**
   * Find logs by context
   */
  findByContext(context: string, limit?: number): Promise<AuditLog[]>;

  /**
   * Find logs by type and level
   */
  findByTypeAndLevel(type: AuditLogType, level: AuditLogLevel, limit?: number): Promise<AuditLog[]>;

  /**
   * Find recent error logs
   */
  findRecentErrors(hours: number, limit?: number): Promise<AuditLog[]>;

  /**
   * Find security-related logs
   */
  findSecurityLogs(fromDate: Date, toDate: Date, limit?: number): Promise<AuditLog[]>;

  /**
   * Count logs by filters
   */
  count(filters?: IAuditLogFilters): Promise<number>;

  /**
   * Delete old audit logs (for retention policy)
   */
  deleteOlderThan(date: Date): Promise<number>;

  /**
   * Get audit statistics
   */
  getStatistics(
    fromDate: Date,
    toDate: Date,
  ): Promise<{
    totalLogs: number;
    byLevel: Record<AuditLogLevel, number>;
    byType: Record<AuditLogType, number>;
    byContext: Record<string, number>;
  }>;
}
