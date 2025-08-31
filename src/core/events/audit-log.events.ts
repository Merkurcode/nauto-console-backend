import { DomainEvent } from './domain-event.base';
import { AuditLogId } from '@core/value-objects/audit-log-id.vo';
import { UserId } from '@core/value-objects/user-id.vo';
import { CompanyId } from '@core/value-objects/company-id.vo';

/**
 * Audit Log Domain Events
 * Following DDD: Events represent significant business moments in the Audit Log lifecycle
 */

export class AuditLogCreatedEvent extends DomainEvent {
  constructor(
    public readonly auditLogId: AuditLogId,
    public readonly userId: UserId,
    public readonly action: string,
    public readonly resource: string,
    public readonly resourceId?: string,
    public readonly companyId?: CompanyId,
    public readonly timestamp?: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'audit_log.created';
  }
}

export class SecurityAuditLogCreatedEvent extends DomainEvent {
  constructor(
    public readonly auditLogId: AuditLogId,
    public readonly userId: UserId,
    public readonly action: string,
    public readonly severity: 'low' | 'medium' | 'high' | 'critical',
    public readonly ipAddress: string,
    public readonly userAgent?: string,
    public readonly timestamp?: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'audit_log.security_created';
  }
}

export class DataAccessAuditLogCreatedEvent extends DomainEvent {
  constructor(
    public readonly auditLogId: AuditLogId,
    public readonly userId: UserId,
    public readonly resource: string,
    public readonly operation: 'read' | 'write' | 'delete',
    public readonly dataClassification: string,
    public readonly recordCount?: number,
    public readonly timestamp?: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'audit_log.data_access_created';
  }
}

export class ComplianceAuditLogCreatedEvent extends DomainEvent {
  constructor(
    public readonly auditLogId: AuditLogId,
    public readonly userId: UserId,
    public readonly complianceType: string,
    public readonly action: string,
    public readonly status: 'compliant' | 'non-compliant' | 'remediated',
    public readonly timestamp?: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'audit_log.compliance_created';
  }
}

export class SystemAuditLogCreatedEvent extends DomainEvent {
  constructor(
    public readonly auditLogId: AuditLogId,
    public readonly component: string,
    public readonly action: string,
    public readonly severity: string,
    public readonly message: string,
    public readonly timestamp?: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'audit_log.system_created';
  }
}

export class AuditLogExportedEvent extends DomainEvent {
  constructor(
    public readonly exportId: string,
    public readonly userId: UserId,
    public readonly dateRange: { from: Date; to: Date },
    public readonly format: 'json' | 'csv' | 'pdf',
    public readonly recordCount: number,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'audit_log.exported';
  }
}

export class AuditLogArchivedEvent extends DomainEvent {
  constructor(
    public readonly archiveId: string,
    public readonly dateRange: { from: Date; to: Date },
    public readonly recordCount: number,
    public readonly archiveLocation: string,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'audit_log.archived';
  }
}

export class AuditLogPurgedEvent extends DomainEvent {
  constructor(
    public readonly dateRange: { from: Date; to: Date },
    public readonly recordCount: number,
    public readonly reason: string,
    public readonly authorizedBy: UserId,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'audit_log.purged';
  }
}

export class AuditLogAlertTriggeredEvent extends DomainEvent {
  constructor(
    public readonly alertId: string,
    public readonly alertType: string,
    public readonly triggerCondition: string,
    public readonly affectedResources: string[],
    public readonly severity: 'low' | 'medium' | 'high' | 'critical',
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'audit_log.alert_triggered';
  }
}

export class AuditLogRetentionPolicyAppliedEvent extends DomainEvent {
  constructor(
    public readonly policyId: string,
    public readonly retentionDays: number,
    public readonly affectedRecords: number,
    public readonly action: 'archive' | 'delete',
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'audit_log.retention_policy_applied';
  }
}

export class BulkAuditLogsCreatedEvent extends DomainEvent {
  constructor(
    public readonly auditLogIds: AuditLogId[],
    public readonly count: number,
    public readonly source: string,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'audit_log.bulk_created';
  }
}
