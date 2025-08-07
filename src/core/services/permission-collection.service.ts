import { Injectable, Inject } from '@nestjs/common';
import { User } from '@core/entities/user.entity';
import { IRoleRepository } from '@core/repositories/role.repository.interface';
import { ROLE_REPOSITORY } from '@shared/constants/tokens';
import { EntityNotFoundException } from '@core/exceptions/domain-exceptions';

/**
 * Domain service responsible for collecting and aggregating user permissions
 */
@Injectable()
export class PermissionCollectionService {
  constructor(
    @Inject(ROLE_REPOSITORY)
    private readonly roleRepository: IRoleRepository,
  ) {}

  /**
   * Collects all permissions from all user roles
   * Business Rule: A user's effective permissions are the union of all their role permissions
   * @param user - User entity with roles
   * @returns Set of unique permission names
   */
  async collectUserPermissions(user: User): Promise<Set<string>> {
    const userPermissions = new Set<string>();

    // Get all roles for the user
    const userRoles = user.rolesCollection.roles;

    // Collect permissions from each role
    for (const role of userRoles) {
      try {
        const roleWithPermissions = await this.roleRepository.findById(role.id.getValue());

        if (roleWithPermissions && roleWithPermissions.permissionsCollection) {
          const permissions = roleWithPermissions.permissionsCollection.permissions;

          permissions.forEach(permission => {
            userPermissions.add(permission.getStringName());
          });
        }
      } catch (error) {
        // Log the error but continue processing other roles
        console.warn(`Failed to load permissions for role ${role.id.getValue()}:`, error);
      }
    }

    return userPermissions;
  }

  /**
   * Checks if user has a specific permission through any of their roles
   * Business Rule: Permission check should traverse all user roles
   * @param user - User entity
   * @param permissionName - Permission name to check
   * @returns boolean indicating if user has the permission
   */
  async hasPermission(user: User, permissionName: string): Promise<boolean> {
    const userPermissions = await this.collectUserPermissions(user);

    return userPermissions.has(permissionName);
  }

  /**
   * Gets permission names for a specific role
   * Business Rule: Role permissions define what actions the role can perform
   * @param roleId - Role identifier
   * @returns Set of permission names for the role
   */
  async getRolePermissions(roleId: string): Promise<Set<string>> {
    const role = await this.roleRepository.findById(roleId);

    if (!role) {
      throw new EntityNotFoundException('Role', roleId);
    }

    const permissions = new Set<string>();

    if (role.permissionsCollection) {
      const rolePermissions = role.permissionsCollection.permissions;
      rolePermissions.forEach(permission => {
        permissions.add(permission.getStringName());
      });
    }

    return permissions;
  }

  /**
   * Gets all unique permissions across multiple roles
   * Business Rule: When checking permissions for role assignment, consider all involved roles
   * @param roleIds - Array of role identifiers
   * @returns Set of unique permission names
   */
  async getPermissionsForRoles(roleIds: string[]): Promise<Set<string>> {
    const allPermissions = new Set<string>();

    for (const roleId of roleIds) {
      try {
        const rolePermissions = await this.getRolePermissions(roleId);
        rolePermissions.forEach(permission => allPermissions.add(permission));
      } catch (error) {
        // Log warning but continue with other roles
        console.warn(`Failed to load permissions for role ${roleId}:`, error);
      }
    }

    return allPermissions;
  }

  /**
   * Validates that a user has the required permissions for an operation
   * Business Rule: Operation access requires explicit permission grants
   * @param user - User entity
   * @param requiredPermissions - Array of required permission names
   * @returns boolean indicating if user has all required permissions
   */
  async hasAllRequiredPermissions(user: User, requiredPermissions: string[]): Promise<boolean> {
    if (requiredPermissions.length === 0) {
      return true;
    }

    const userPermissions = await this.collectUserPermissions(user);

    return requiredPermissions.every(permission => userPermissions.has(permission));
  }
}
