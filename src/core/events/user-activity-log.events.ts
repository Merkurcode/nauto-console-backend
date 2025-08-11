import { DomainEvent } from './domain-event.base';
import { UserId } from '@core/value-objects/user-id.vo';
import { UserActivityType } from '@shared/constants/user-activity-type.enum';
import { UserActivityImpact } from '@shared/constants/user-activity-impact.enum';

export class UserActivityLogCreatedEvent extends DomainEvent {
  constructor(
    public readonly userActivityLogId: string,
    public readonly userId: UserId,
    public readonly activityType: UserActivityType,
    public readonly action: string,
    public readonly description: string,
    public readonly impact: UserActivityImpact,
    public readonly version: string,
    public readonly ipAddress?: string,
    public readonly userAgent?: string,
    public readonly metadata?: Record<string, unknown>,
  ) {
    super();
  }

  getEventName(): string {
    return 'user_activity_log.created';
  }
}

export class LowImpactActivityLoggedEvent extends DomainEvent {
  constructor(
    public readonly userActivityLogId: string,
    public readonly userId: UserId,
    public readonly activityType: UserActivityType,
    public readonly action: string,
    public readonly description: string,
    public readonly version: string,
    public readonly ipAddress?: string,
    public readonly userAgent?: string,
    public readonly metadata?: Record<string, unknown>,
  ) {
    super();
  }

  getEventName(): string {
    return 'user_activity_log.low_impact';
  }
}

export class MediumImpactActivityLoggedEvent extends DomainEvent {
  constructor(
    public readonly userActivityLogId: string,
    public readonly userId: UserId,
    public readonly activityType: UserActivityType,
    public readonly action: string,
    public readonly description: string,
    public readonly version: string,
    public readonly ipAddress?: string,
    public readonly userAgent?: string,
    public readonly metadata?: Record<string, unknown>,
  ) {
    super();
  }

  getEventName(): string {
    return 'user_activity_log.medium_impact';
  }
}

export class HighImpactActivityLoggedEvent extends DomainEvent {
  constructor(
    public readonly userActivityLogId: string,
    public readonly userId: UserId,
    public readonly activityType: UserActivityType,
    public readonly action: string,
    public readonly description: string,
    public readonly version: string,
    public readonly ipAddress?: string,
    public readonly userAgent?: string,
    public readonly metadata?: Record<string, unknown>,
  ) {
    super();
  }

  getEventName(): string {
    return 'user_activity_log.high_impact';
  }
}

export class CriticalImpactActivityLoggedEvent extends DomainEvent {
  constructor(
    public readonly userActivityLogId: string,
    public readonly userId: UserId,
    public readonly activityType: UserActivityType,
    public readonly action: string,
    public readonly description: string,
    public readonly version: string,
    public readonly ipAddress?: string,
    public readonly userAgent?: string,
    public readonly metadata?: Record<string, unknown>,
  ) {
    super();
  }

  getEventName(): string {
    return 'user_activity_log.critical_impact';
  }
}

export class AuthenticationActivityCreatedEvent extends DomainEvent {
  constructor(
    public readonly userActivityLogId: string,
    public readonly userId: UserId,
    public readonly action: string,
    public readonly description: string,
    public readonly impact: UserActivityImpact,
    public readonly version: string,
    public readonly ipAddress?: string,
    public readonly userAgent?: string,
    public readonly metadata?: Record<string, unknown>,
  ) {
    super();
  }

  getEventName(): string {
    return 'user_activity_log.authentication_created';
  }
}

export class ProfileManagementActivityCreatedEvent extends DomainEvent {
  constructor(
    public readonly userActivityLogId: string,
    public readonly userId: UserId,
    public readonly action: string,
    public readonly description: string,
    public readonly impact: UserActivityImpact,
    public readonly version: string,
    public readonly ipAddress?: string,
    public readonly userAgent?: string,
    public readonly metadata?: Record<string, unknown>,
  ) {
    super();
  }

  getEventName(): string {
    return 'user_activity_log.profile_management_created';
  }
}

export class RoleManagementActivityCreatedEvent extends DomainEvent {
  constructor(
    public readonly userActivityLogId: string,
    public readonly userId: UserId,
    public readonly action: string,
    public readonly description: string,
    public readonly impact: UserActivityImpact,
    public readonly version: string,
    public readonly ipAddress?: string,
    public readonly userAgent?: string,
    public readonly metadata?: Record<string, unknown>,
  ) {
    super();
  }

  getEventName(): string {
    return 'user_activity_log.role_management_created';
  }
}

export class SecuritySettingsActivityCreatedEvent extends DomainEvent {
  constructor(
    public readonly userActivityLogId: string,
    public readonly userId: UserId,
    public readonly action: string,
    public readonly description: string,
    public readonly impact: UserActivityImpact,
    public readonly version: string,
    public readonly ipAddress?: string,
    public readonly userAgent?: string,
    public readonly metadata?: Record<string, unknown>,
  ) {
    super();
  }

  getEventName(): string {
    return 'user_activity_log.security_settings_created';
  }
}

export class CompanyAssignmentActivityCreatedEvent extends DomainEvent {
  constructor(
    public readonly userActivityLogId: string,
    public readonly userId: UserId,
    public readonly action: string,
    public readonly description: string,
    public readonly impact: UserActivityImpact,
    public readonly version: string,
    public readonly ipAddress?: string,
    public readonly userAgent?: string,
    public readonly metadata?: Record<string, unknown>,
  ) {
    super();
  }

  getEventName(): string {
    return 'user_activity_log.company_assignment_created';
  }
}

export class AccountManagementActivityCreatedEvent extends DomainEvent {
  constructor(
    public readonly userActivityLogId: string,
    public readonly userId: UserId,
    public readonly action: string,
    public readonly description: string,
    public readonly impact: UserActivityImpact,
    public readonly version: string,
    public readonly ipAddress?: string,
    public readonly userAgent?: string,
    public readonly metadata?: Record<string, unknown>,
  ) {
    super();
  }

  getEventName(): string {
    return 'user_activity_log.account_management_created';
  }
}
