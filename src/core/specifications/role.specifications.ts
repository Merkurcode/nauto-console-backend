import { Specification } from './specification.base';
import { Role } from '@core/entities/role.entity';
import { Permission } from '@core/entities/permission.entity';
import { PermissionId } from '@core/value-objects/permission-id.vo';
import { RolesEnum } from '@shared/constants/enums';
import {
  SPECIFICATION_CRITICAL_RESOURCES,
  SPECIFICATION_CRITICAL_ACTIONS,
} from '@shared/constants/system-constants';

/**
 * Specification to check if a role is the default role
 */
export class DefaultRoleSpecification extends Specification<Role> {
  isSatisfiedBy(role: Role): boolean {
    return role.isDefault;
  }
}

/**
 * Specification to check if a role is an admin role
 */
export class AdminRoleSpecification extends Specification<Role> {
  isSatisfiedBy(role: Role): boolean {
    return role.isAdminRole();
  }
}

/**
 * Specification to check if a role is a root role
 */
export class RootRoleSpecification extends Specification<Role> {
  isSatisfiedBy(role: Role): boolean {
    return role.name.toLowerCase() === RolesEnum.ROOT.toLowerCase();
  }
}

/**
 * Specification to check if a role is a root readonly role
 */
export class RootReadOnlyRoleSpecification extends Specification<Role> {
  isSatisfiedBy(role: Role): boolean {
    return role.name.toLowerCase() === RolesEnum.ROOT_READONLY.toLowerCase();
  }
}

/**
 * Specification to check if a role is any root level role (root or root_readonly)
 */
export class RootLevelRoleSpecification extends Specification<Role> {
  isSatisfiedBy(role: Role): boolean {
    const roleName = role.name.toLowerCase();

    return (
      roleName === RolesEnum.ROOT.toLowerCase() ||
      roleName === RolesEnum.ROOT_READONLY.toLowerCase()
    );
  }
}

/**
 * Specification to check if a role has a specific permission
 */
export class RoleHasPermissionSpecification extends Specification<Role> {
  constructor(private readonly permissionId: PermissionId) {
    super();
  }

  isSatisfiedBy(role: Role): boolean {
    return role.hasPermission(this.permissionId);
  }
}

/**
 * Specification to check if a role has permissions by name
 */
export class RoleHasPermissionByNameSpecification extends Specification<Role> {
  constructor(private readonly permissionName: string) {
    super();
  }

  isSatisfiedBy(role: Role): boolean {
    return role.hasPermissionByName(this.permissionName);
  }
}

/**
 * Specification to check if a role can be deleted
 */
export class CanDeleteRoleSpecification extends Specification<Role> {
  isSatisfiedBy(role: Role): boolean {
    return role.canBeDeleted();
  }
}

/**
 * Specification to check if a permission can be assigned to a role
 */
export class CanAssignPermissionToRoleSpecification extends Specification<Role> {
  constructor(private readonly permission: Permission) {
    super();
  }

  isSatisfiedBy(role: Role): boolean {
    // Permission is not already assigned
    if (role.hasPermission(this.permission.id)) {
      return false;
    }

    // Additional business rules can be added here
    // For example: certain permissions might require root level roles
    if (this.isSystemCriticalPermission(this.permission) && !role.isRootLevelRole()) {
      return false;
    }

    return true;
  }

  private isSystemCriticalPermission(permission: Permission): boolean {
    // Business rule: System critical permissions require root level roles
    const resource = permission.getResource().toLowerCase();
    const action = permission.getAction().toLowerCase();

    return (
      SPECIFICATION_CRITICAL_RESOURCES.some(criticalResource => criticalResource === resource) &&
      SPECIFICATION_CRITICAL_ACTIONS.some(criticalAction => criticalAction === action)
    );
  }
}

/**
 * Specification to check if a role has minimum required permissions
 */
export class HasMinimumPermissionsSpecification extends Specification<Role> {
  constructor(private readonly minimumCount: number = 1) {
    super();
  }

  isSatisfiedBy(role: Role): boolean {
    return role.permissions.length >= this.minimumCount;
  }
}

/**
 * Specification to check if a role is a basic user role
 */
export class BasicUserRoleSpecification extends Specification<Role> {
  isSatisfiedBy(role: Role): boolean {
    return (
      !role.isRootLevelRole() && // Not root or root_readonly
      !role.isAdminRole() && // Not admin
      !role.isDefault && // Not default role (guest)
      role.permissions.length > 0
      // Removed arbitrary permission limit - basic roles can have any number of permissions
    );
  }
}
