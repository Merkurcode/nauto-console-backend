import { Injectable, Inject } from '@nestjs/common';
import { IRoleRepository } from '@core/repositories/role.repository.interface';
import { IPermissionRepository } from '@core/repositories/permission.repository.interface';
import { REPOSITORY_TOKENS } from '@shared/constants/tokens';
import { PERMISSION_EXCLUDE_SYMBOLS } from '@shared/constants/permission-exclude';
import { PermissionExcludeViolationException } from '@core/exceptions/permission-exclude-violation.exception';

@Injectable()
export class PermissionExcludeService {
  constructor(
    @Inject(REPOSITORY_TOKENS.PERMISSION_REPOSITORY)
    private readonly permissionRepository: IPermissionRepository,
    @Inject(REPOSITORY_TOKENS.ROLE_REPOSITORY)
    private readonly roleRepository: IRoleRepository,
  ) {}

  /**
   * Validates if a role can be assigned a specific permission based on exclude rules
   * @param roleName - The role name to validate
   * @param permissionName - The permission name to validate
   * @throws PermissionExcludeViolationException if role is excluded
   */
  async validateRolePermissionAssignment(roleName: string, permissionName: string): Promise<void> {
    const permission = await this.permissionRepository.findByName(permissionName);

    if (!permission) {
      throw new Error(`Permission '${permissionName}' not found`);
    }

    const excludeRoles = this.parseExcludeRoles(permission.excludeRoles);

    if (await this.isRoleExcluded(roleName, excludeRoles)) {
      throw new PermissionExcludeViolationException(roleName, permissionName, excludeRoles);
    }
  }

  /**
   * Validates multiple role-permission assignments
   * @param roleName - The role name to validate
   * @param permissionNames - Array of permission names to validate
   * @throws PermissionExcludeViolationException if any permission is excluded for the role
   */
  async validateMultipleRolePermissionAssignments(
    roleName: string,
    permissionNames: string[],
  ): Promise<void> {
    for (const permissionName of permissionNames) {
      await this.validateRolePermissionAssignment(roleName, permissionName);
    }
  }

  /**
   * Filters out excluded permissions for a role
   * @param roleName - The role name
   * @param permissionNames - Array of permission names to filter
   * @returns Array of allowed permission names
   */
  async filterAllowedPermissions(roleName: string, permissionNames: string[]): Promise<string[]> {
    const allowedPermissions: string[] = [];

    for (const permissionName of permissionNames) {
      try {
        await this.validateRolePermissionAssignment(roleName, permissionName);
        allowedPermissions.push(permissionName);
      } catch (error) {
        if (error instanceof PermissionExcludeViolationException) {
          // Skip excluded permission
          continue;
        }
        throw error; // Re-throw other errors
      }
    }

    return allowedPermissions;
  }

  /**
   * Gets all permissions with assignability info for a role
   * @param currentUserRoleName - The role making the assignment
   * @param targetRoleName - Optional target role to check assignment to
   * @returns Array of permissions with assignment status
   */
  async getAssignablePermissions(
    currentUserRoleName: string,
    targetRoleName?: string,
  ): Promise<
    Array<{
      id: string;
      name: string;
      description: string;
      resource: string;
      action: string;
      canAssign: boolean;
      excludeReason?: string;
    }>
  > {
    // Get all permissions
    const permissions = await this.permissionRepository.findAllOrderByName();

    // Get current user role info
    const currentRole = await this.roleRepository.findByName(currentUserRoleName);
    if (!currentRole) {
      throw new Error(`Role '${currentUserRoleName}' not found`);
    }

    const results = [];

    for (const permission of permissions) {
      const excludeRoles = this.parseExcludeRoles(permission.excludeRoles);
      const canCurrentUserAssign = !(await this.isRoleExcluded(currentUserRoleName, excludeRoles));

      let excludeReason: string | undefined;
      let finalCanAssign = canCurrentUserAssign;

      if (!canCurrentUserAssign) {
        excludeReason = await this.getExcludeReason(currentUserRoleName, excludeRoles);
        finalCanAssign = false;
      }

      // If we're checking for a specific target role, also validate that
      if (targetRoleName && finalCanAssign) {
        const targetRole = await this.roleRepository.findByName(targetRoleName);
        if (targetRole) {
          const targetCanReceive = !(await this.isRoleExcluded(targetRoleName, excludeRoles));
          if (!targetCanReceive) {
            excludeReason = `Target role '${targetRoleName}' is excluded from this permission`;
            finalCanAssign = false;
          }
        }
      }

      results.push({
        id: permission.id.getValue(),
        name: permission.getPermissionName(),
        description: permission.description,
        resource: permission.getResource(),
        action: permission.getAction(),
        canAssign: finalCanAssign,
        excludeReason,
      });
    }

    return results;
  }

  /**
   * Gets all permissions that can be assigned to a specific target role
   * @param targetRoleName - The role to check permissions for
   * @returns Array of permissions that the target role can receive
   */
  async getPermissionsForTargetRole(targetRoleName: string): Promise<
    Array<{
      id: string;
      name: string;
      description: string;
      resource: string;
      action: string;
      canAssign: boolean;
      excludeReason?: string;
    }>
  > {
    // Get all permissions
    const permissions = await this.permissionRepository.findAllOrderByName();

    // Verify target role exists
    const targetRole = await this.roleRepository.findByName(targetRoleName);
    if (!targetRole) {
      throw new Error(`Target role '${targetRoleName}' not found`);
    }

    const results = [];

    for (const permission of permissions) {
      const excludeRoles = this.parseExcludeRoles(permission.excludeRoles);

      // Check if the target role can receive this permission
      const targetCanReceive = !(await this.isRoleExcluded(targetRoleName, excludeRoles));

      let excludeReason: string | undefined;
      if (!targetCanReceive) {
        excludeReason = await this.getExcludeReason(targetRoleName, excludeRoles);
      }

      results.push({
        id: permission.id.getValue(),
        name: permission.getPermissionName(),
        description: permission.description,
        resource: permission.getResource(),
        action: permission.getAction(),
        canAssign: targetCanReceive,
        excludeReason,
      });
    }

    return results;
  }

  /**
   * Gets all permissions with assignability info for multiple roles combined
   * @param currentUserRoleNames - Single role name or array of role names
   * @param targetRoleName - Optional target role to check assignment to
   * @returns Array of permissions with combined assignment status
   */
  async getAssignablePermissionsForMultipleRoles(
    currentUserRoleNames: string | string[],
    targetRoleName?: string,
  ): Promise<
    Array<{
      id: string;
      name: string;
      description: string;
      resource: string;
      action: string;
      canAssign: boolean;
      excludeReason?: string;
    }>
  > {
    // Convert to array for uniform processing
    const roleNames = Array.isArray(currentUserRoleNames)
      ? currentUserRoleNames
      : [currentUserRoleNames];

    // Get all permissions
    const permissions = await this.permissionRepository.findAllOrderByName();

    const results = [];

    for (const permission of permissions) {
      const excludeRoles = this.parseExcludeRoles(permission.excludeRoles);

      // Check if ANY of the user's roles can assign this permission
      let canCurrentUserAssign = false;
      const excludeReasons: string[] = [];

      for (const roleName of roleNames) {
        const roleCanAssign = !(await this.isRoleExcluded(roleName, excludeRoles));
        if (roleCanAssign) {
          canCurrentUserAssign = true;
          break; // If any role can assign, no need to check others
        } else {
          const reason = await this.getExcludeReason(roleName, excludeRoles);
          if (reason) {
            excludeReasons.push(`${roleName}: ${reason}`);
          }
        }
      }

      let excludeReason: string | undefined;
      let finalCanAssign = canCurrentUserAssign;

      if (!canCurrentUserAssign) {
        excludeReason =
          excludeReasons.length > 0
            ? excludeReasons.join('; ')
            : 'All roles are excluded from this permission';
        finalCanAssign = false;
      }

      // If we're checking for a specific target role, also validate that
      if (targetRoleName && finalCanAssign) {
        const targetRole = await this.roleRepository.findByName(targetRoleName);
        if (targetRole) {
          const targetCanReceive = !(await this.isRoleExcluded(targetRoleName, excludeRoles));
          if (!targetCanReceive) {
            excludeReason = `Target role '${targetRoleName}' is excluded from this permission`;
            finalCanAssign = false;
          }
        }
      }

      results.push({
        id: permission.id.getValue(),
        name: permission.getPermissionName(),
        description: permission.description,
        resource: permission.getResource(),
        action: permission.getAction(),
        canAssign: finalCanAssign,
        excludeReason,
      });
    }

    return results;
  }

  /**
   * Gets the reason why a role is excluded from a permission
   */
  private async getExcludeReason(roleName: string, excludeRoles: string[] | null): Promise<string> {
    if (!excludeRoles || excludeRoles.length === 0) {
      return '';
    }

    if (excludeRoles.includes(PERMISSION_EXCLUDE_SYMBOLS.ALL_ROLES)) {
      return 'All roles are excluded from this permission';
    }

    if (excludeRoles.includes(PERMISSION_EXCLUDE_SYMBOLS.ALL_EXCEPT)) {
      const exceptRoles = excludeRoles.filter(
        role => role !== PERMISSION_EXCLUDE_SYMBOLS.ALL_EXCEPT,
      );
      if (!exceptRoles.includes(roleName)) {
        return `All roles except [${exceptRoles.join(', ')}] are excluded from this permission`;
      }
    }

    if (excludeRoles.includes(PERMISSION_EXCLUDE_SYMBOLS.ALLOW_CUSTOM_AND_LISTED)) {
      const allowedRoles = excludeRoles.filter(
        role => role !== PERMISSION_EXCLUDE_SYMBOLS.ALLOW_CUSTOM_AND_LISTED,
      );
      const role = await this.roleRepository.findByName(roleName);

      if (role && role.isDefaultAppRole && !allowedRoles.includes(roleName)) {
        return `Only custom roles and [${allowedRoles.join(', ')}] are allowed for this permission`;
      }
    }

    if (excludeRoles.includes(PERMISSION_EXCLUDE_SYMBOLS.CUSTOM_ROLES)) {
      const role = await this.roleRepository.findByName(roleName);
      if (role && !role.isDefaultAppRole) {
        return 'Custom roles are excluded from this permission';
      }
    }

    if (excludeRoles.includes(PERMISSION_EXCLUDE_SYMBOLS.DEFAULT_ROLES)) {
      const role = await this.roleRepository.findByName(roleName);
      if (role && role.isDefaultAppRole) {
        return 'Default roles are excluded from this permission (only custom roles allowed)';
      }
    }

    if (excludeRoles.includes(roleName)) {
      return `Role '${roleName}' is specifically excluded from this permission`;
    }

    return '';
  }

  /**
   * Parses exclude roles from JSON string
   */
  private parseExcludeRoles(excludeRolesJson: string | null): string[] | null {
    if (!excludeRolesJson) {
      return null;
    }

    try {
      return JSON.parse(excludeRolesJson);
    } catch (error) {
      console.error('Failed to parse excludeRoles JSON:', excludeRolesJson, error);

      return null;
    }
  }

  /**
   * Checks if a role is excluded from a permission
   */
  private async isRoleExcluded(roleName: string, excludeRoles: string[] | null): Promise<boolean> {
    if (!excludeRoles || excludeRoles.length === 0) {
      return false; // No exclusions, role is allowed
    }

    if (excludeRoles.includes(PERMISSION_EXCLUDE_SYMBOLS.ALL_ROLES)) {
      return true; // All roles are excluded
    }

    // Check if using "all except" pattern
    if (excludeRoles.includes(PERMISSION_EXCLUDE_SYMBOLS.ALL_EXCEPT)) {
      const exceptRoles = excludeRoles.filter(
        role => role !== PERMISSION_EXCLUDE_SYMBOLS.ALL_EXCEPT,
      );

      return !exceptRoles.includes(roleName); // Exclude if NOT in the exception list
    }

    // Check if using "allow custom roles plus listed" pattern
    if (excludeRoles.includes(PERMISSION_EXCLUDE_SYMBOLS.ALLOW_CUSTOM_AND_LISTED)) {
      const allowedRoles = excludeRoles.filter(
        role => role !== PERMISSION_EXCLUDE_SYMBOLS.ALLOW_CUSTOM_AND_LISTED,
      );
      const role = await this.roleRepository.findByName(roleName);

      // Allow if it's a custom role OR if it's in the allowed list
      if (role && !role.isDefaultAppRole) {
        return false; // Custom role is allowed
      }

      return !allowedRoles.includes(roleName); // Exclude if NOT in the allowed list
    }

    // Check if custom roles are excluded and this is a custom role
    if (excludeRoles.includes(PERMISSION_EXCLUDE_SYMBOLS.CUSTOM_ROLES)) {
      const role = await this.roleRepository.findByName(roleName);
      if (role && !role.isDefaultAppRole) {
        return true; // This is a custom role and custom roles are excluded
      }
    }

    // Check if default roles are excluded and this is a default role
    if (excludeRoles.includes(PERMISSION_EXCLUDE_SYMBOLS.DEFAULT_ROLES)) {
      const role = await this.roleRepository.findByName(roleName);
      if (role && role.isDefaultAppRole) {
        return true; // This is a default role and default roles are excluded
      }
    }

    return excludeRoles.includes(roleName); // Check if specific role is excluded
  }
}
