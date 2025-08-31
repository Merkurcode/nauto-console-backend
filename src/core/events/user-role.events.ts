import { DomainEvent } from './domain-event.base';
import { EntityId } from '@core/value-objects/entity-id.vo';
import { UserId } from '@core/value-objects/user-id.vo';
import { RoleId } from '@core/value-objects/role-id.vo';

/**
 * User Role Domain Events
 * Following DDD: Events represent significant business moments in the User Role lifecycle
 */

export class UserRoleCreatedEvent extends DomainEvent {
  constructor(
    public readonly id: EntityId,
    public readonly userId: UserId,
    public readonly roleId: RoleId,
    public readonly userName: string,
    public readonly roleName: string,
    public readonly assignedBy: UserId,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'user_role.created';
  }
}

export class UserRoleDeletedEvent extends DomainEvent {
  constructor(
    public readonly id: EntityId,
    public readonly userId: UserId,
    public readonly roleId: RoleId,
    public readonly userName: string,
    public readonly roleName: string,
    public readonly removedBy: UserId,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'user_role.deleted';
  }
}

export class BulkUserRolesAssignedEvent extends DomainEvent {
  constructor(
    public readonly userId: UserId,
    public readonly userName: string,
    public readonly roleIds: RoleId[],
    public readonly roleNames: string[],
    public readonly count: number,
    public readonly assignedBy: UserId,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'user_role.bulk_assigned';
  }
}

export class BulkUserRolesRemovedEvent extends DomainEvent {
  constructor(
    public readonly userId: UserId,
    public readonly userName: string,
    public readonly roleIds: RoleId[],
    public readonly roleNames: string[],
    public readonly count: number,
    public readonly removedBy: UserId,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'user_role.bulk_removed';
  }
}

export class AllUserRolesClearedEvent extends DomainEvent {
  constructor(
    public readonly userId: UserId,
    public readonly userName: string,
    public readonly clearedCount: number,
    public readonly clearedBy: UserId,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'user_role.all_cleared';
  }
}

export class UserRolesSyncedEvent extends DomainEvent {
  constructor(
    public readonly userId: UserId,
    public readonly userName: string,
    public readonly addedRoles: RoleId[],
    public readonly removedRoles: RoleId[],
    public readonly totalRoles: number,
    public readonly syncedBy: UserId,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'user_role.synced';
  }
}

export class UserRoleEscalatedEvent extends DomainEvent {
  constructor(
    public readonly id: EntityId,
    public readonly userId: UserId,
    public readonly userName: string,
    public readonly oldRoleId: RoleId,
    public readonly newRoleId: RoleId,
    public readonly oldRoleName: string,
    public readonly newRoleName: string,
    public readonly escalatedBy: UserId,
    public readonly reason: string,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'user_role.escalated';
  }
}

export class UserRoleDegradedEvent extends DomainEvent {
  constructor(
    public readonly id: EntityId,
    public readonly userId: UserId,
    public readonly userName: string,
    public readonly oldRoleId: RoleId,
    public readonly newRoleId: RoleId,
    public readonly oldRoleName: string,
    public readonly newRoleName: string,
    public readonly degradedBy: UserId,
    public readonly reason: string,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'user_role.degraded';
  }
}
