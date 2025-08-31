import { DomainEvent } from './domain-event.base';
import { CompanyScheduleId } from '@core/value-objects/company-schedule-id.vo';
import { CompanyId } from '@core/value-objects/company-id.vo';
import { UserId } from '@core/value-objects/user-id.vo';

/**
 * Company Schedules Domain Events
 * Following DDD: Events represent significant business moments in the Company Schedules lifecycle
 */

export class CompanyScheduleCreatedEvent extends DomainEvent {
  constructor(
    public readonly scheduleId: CompanyScheduleId,
    public readonly companyId: CompanyId,
    public readonly name: string,
    public readonly timezone: string,
    public readonly isDefault: boolean,
    public readonly createdBy: UserId,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'company_schedule.created';
  }
}

export class CompanyScheduleUpdatedEvent extends DomainEvent {
  constructor(
    public readonly scheduleId: CompanyScheduleId,
    public readonly companyId: CompanyId,
    public readonly name: string,
    public readonly changes: {
      name?: string;
      timezone?: string;
      isDefault?: boolean;
    },
    public readonly updatedBy: UserId,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'company_schedule.updated';
  }
}

export class CompanyScheduleDeletedEvent extends DomainEvent {
  constructor(
    public readonly scheduleId: CompanyScheduleId,
    public readonly companyId: CompanyId,
    public readonly name: string,
    public readonly deletedBy: UserId,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'company_schedule.deleted';
  }
}

export class CompanyScheduleSetAsDefaultEvent extends DomainEvent {
  constructor(
    public readonly scheduleId: CompanyScheduleId,
    public readonly companyId: CompanyId,
    public readonly name: string,
    public readonly previousDefaultId?: CompanyScheduleId,
    public readonly setBy?: UserId,
    public readonly timestamp?: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'company_schedule.set_as_default';
  }
}

export class CompanyScheduleActivatedEvent extends DomainEvent {
  constructor(
    public readonly scheduleId: CompanyScheduleId,
    public readonly companyId: CompanyId,
    public readonly name: string,
    public readonly activatedBy: UserId,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'company_schedule.activated';
  }
}

export class CompanyScheduleDeactivatedEvent extends DomainEvent {
  constructor(
    public readonly scheduleId: CompanyScheduleId,
    public readonly companyId: CompanyId,
    public readonly name: string,
    public readonly deactivatedBy: UserId,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'company_schedule.deactivated';
  }
}

export class CompanyScheduleTimezoneChangedEvent extends DomainEvent {
  constructor(
    public readonly scheduleId: CompanyScheduleId,
    public readonly companyId: CompanyId,
    public readonly name: string,
    public readonly oldTimezone: string,
    public readonly newTimezone: string,
    public readonly changedBy: UserId,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'company_schedule.timezone_changed';
  }
}

export class BulkCompanySchedulesCreatedEvent extends DomainEvent {
  constructor(
    public readonly companyId: CompanyId,
    public readonly scheduleIds: CompanyScheduleId[],
    public readonly count: number,
    public readonly createdBy: UserId,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'company_schedule.bulk_created';
  }
}
