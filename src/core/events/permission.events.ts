import { DomainEvent } from './domain-event.base';
import { PermissionId } from '@core/value-objects/permission-id.vo';
import { RoleId } from '@core/value-objects/role-id.vo';

/**
 * Permission Domain Events
 * Following DDD: Events represent significant business moments in the Permission lifecycle
 */

export class PermissionCreatedEvent extends DomainEvent {
  constructor(
    public readonly permissionId: PermissionId,
    public readonly permissionName: string,
    public readonly resource: string,
    public readonly action: string,
    public readonly description: string,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'permission.created';
  }
}

export class PermissionUpdatedEvent extends DomainEvent {
  constructor(
    public readonly permissionId: PermissionId,
    public readonly permissionName: string,
    public readonly changes: {
      description?: string;
      resource?: string;
      action?: string;
      excludeRoles?: string[];
    },
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'permission.updated';
  }
}

export class PermissionDeletedEvent extends DomainEvent {
  constructor(
    public readonly permissionId: PermissionId,
    public readonly permissionName: string,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'permission.deleted';
  }
}

export class PermissionAssignedToRoleEvent extends DomainEvent {
  constructor(
    public readonly permissionId: PermissionId,
    public readonly roleId: RoleId,
    public readonly permissionName: string,
    public readonly roleName: string,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'permission.assigned_to_role';
  }
}

export class PermissionRemovedFromRoleEvent extends DomainEvent {
  constructor(
    public readonly permissionId: PermissionId,
    public readonly roleId: RoleId,
    public readonly permissionName: string,
    public readonly roleName: string,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'permission.removed_from_role';
  }
}

export class PermissionExcludeRolesUpdatedEvent extends DomainEvent {
  constructor(
    public readonly permissionId: PermissionId,
    public readonly permissionName: string,
    public readonly excludeRoles: string[],
    public readonly previousExcludeRoles: string[],
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'permission.exclude_roles_updated';
  }
}

export class PermissionActivatedEvent extends DomainEvent {
  constructor(
    public readonly permissionId: PermissionId,
    public readonly permissionName: string,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'permission.activated';
  }
}

export class PermissionDeactivatedEvent extends DomainEvent {
  constructor(
    public readonly permissionId: PermissionId,
    public readonly permissionName: string,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'permission.deactivated';
  }
}

export class BulkPermissionsCreatedEvent extends DomainEvent {
  constructor(
    public readonly permissionIds: PermissionId[],
    public readonly count: number,
    public readonly resource: string,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'permission.bulk_created';
  }
}

export class PermissionResourceGroupUpdatedEvent extends DomainEvent {
  constructor(
    public readonly resource: string,
    public readonly permissions: string[],
    public readonly action: 'added' | 'removed' | 'updated',
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'permission.resource_group_updated';
  }
}

export class PermissionSyncedEvent extends DomainEvent {
  constructor(
    public readonly addedCount: number,
    public readonly updatedCount: number,
    public readonly removedCount: number,
    public readonly totalPermissions: number,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'permission.synced';
  }
}
