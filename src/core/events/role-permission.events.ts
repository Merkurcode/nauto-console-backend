import { DomainEvent } from './domain-event.base';
import { EntityId } from '@core/value-objects/entity-id.vo';
import { RoleId } from '@core/value-objects/role-id.vo';
import { PermissionId } from '@core/value-objects/permission-id.vo';

/**
 * Role Permission Domain Events
 * Following DDD: Events represent significant business moments in the Role Permission lifecycle
 */

export class RolePermissionCreatedEvent extends DomainEvent {
  constructor(
    public readonly id: EntityId,
    public readonly roleId: RoleId,
    public readonly permissionId: PermissionId,
    public readonly roleName: string,
    public readonly permissionName: string,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'role_permission.created';
  }
}

export class RolePermissionDeletedEvent extends DomainEvent {
  constructor(
    public readonly id: EntityId,
    public readonly roleId: RoleId,
    public readonly permissionId: PermissionId,
    public readonly roleName: string,
    public readonly permissionName: string,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'role_permission.deleted';
  }
}

export class BulkRolePermissionsCreatedEvent extends DomainEvent {
  constructor(
    public readonly roleId: RoleId,
    public readonly roleName: string,
    public readonly permissionIds: PermissionId[],
    public readonly permissionNames: string[],
    public readonly count: number,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'role_permission.bulk_created';
  }
}

export class BulkRolePermissionsDeletedEvent extends DomainEvent {
  constructor(
    public readonly roleId: RoleId,
    public readonly roleName: string,
    public readonly permissionIds: PermissionId[],
    public readonly permissionNames: string[],
    public readonly count: number,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'role_permission.bulk_deleted';
  }
}

export class AllRolePermissionsClearedEvent extends DomainEvent {
  constructor(
    public readonly roleId: RoleId,
    public readonly roleName: string,
    public readonly clearedCount: number,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'role_permission.all_cleared';
  }
}

export class RolePermissionsSyncedEvent extends DomainEvent {
  constructor(
    public readonly roleId: RoleId,
    public readonly roleName: string,
    public readonly addedCount: number,
    public readonly removedCount: number,
    public readonly totalPermissions: number,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'role_permission.synced';
  }
}
