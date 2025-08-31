import { DomainEvent } from './domain-event.base';
import { RoleId } from '@core/value-objects/role-id.vo';
import { PermissionId } from '@core/value-objects/permission-id.vo';

/**
 * Role Domain Events
 * Following DDD: Events represent significant business moments in the Role lifecycle
 */

export class RoleCreatedEvent extends DomainEvent {
  constructor(
    public readonly roleId: RoleId,
    public readonly roleName: string,
    public readonly description: string,
    public readonly isDefaultAppRole: boolean,
    public readonly canBeDeleted: boolean,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'role.created';
  }
}

export class RoleUpdatedEvent extends DomainEvent {
  constructor(
    public readonly roleId: RoleId,
    public readonly roleName: string,
    public readonly description: string,
    public readonly previousName?: string,
    public readonly previousDescription?: string,
    public readonly timestamp?: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'role.updated';
  }
}

export class RoleDeletedEvent extends DomainEvent {
  constructor(
    public readonly roleId: RoleId,
    public readonly roleName: string,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'role.deleted';
  }
}

export class PermissionAddedToRoleEvent extends DomainEvent {
  constructor(
    public readonly roleId: RoleId,
    public readonly permissionId: PermissionId,
    public readonly permissionName: string,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'role.permission_added';
  }
}

export class PermissionRemovedFromRoleEvent extends DomainEvent {
  constructor(
    public readonly roleId: RoleId,
    public readonly permissionId: PermissionId,
    public readonly permissionName: string,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'permission.removed_from_role';
  }
}

export class RoleActivatedEvent extends DomainEvent {
  constructor(
    public readonly roleId: RoleId,
    public readonly roleName: string,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'role.activated';
  }
}

export class RoleDeactivatedEvent extends DomainEvent {
  constructor(
    public readonly roleId: RoleId,
    public readonly roleName: string,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'role.deactivated';
  }
}

export class RoleAssignedToUserEvent extends DomainEvent {
  constructor(
    public readonly roleId: RoleId,
    public readonly userId: string,
    public readonly roleName: string,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'role.assigned_to_user';
  }
}

export class RoleRemovedFromUserEvent extends DomainEvent {
  constructor(
    public readonly roleId: RoleId,
    public readonly userId: string,
    public readonly roleName: string,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'role.removed_from_user';
  }
}

export class BulkPermissionsAddedToRoleEvent extends DomainEvent {
  constructor(
    public readonly roleId: RoleId,
    public readonly permissionIds: PermissionId[],
    public readonly permissionCount: number,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'role.bulk_permissions_added';
  }
}

export class AllPermissionsRemovedFromRoleEvent extends DomainEvent {
  constructor(
    public readonly roleId: RoleId,
    public readonly removedCount: number,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'role.all_permissions_removed';
  }
}
