import { Injectable } from '@nestjs/common';
import { User } from '@core/entities/user.entity';
import { Role } from '@core/entities/role.entity';

// Interface for lightweight user authorization checks
interface IUserAuthInfo {
  isActive: boolean;
  hasPermission(permissionName: string): boolean;
}
import {
  ActiveUserSpecification,
  TwoFactorEnabledSpecification,
  AdminUserSpecification,
  RootLevelUserSpecification,
  CanAssignRoleSpecification,
  EligibleForAdminRoleSpecification,
  CompleteUserAccountSpecification,
} from '@core/specifications/user.specifications';
import {
  RootLevelRoleSpecification,
  CanDeleteRoleSpecification,
} from '@core/specifications/role.specifications';

/**
 * Domain service for user authorization and access control business logic
 * Uses the Specification pattern to encapsulate complex business rules
 */
@Injectable()
export class UserAuthorizationService {
  /**
   * Check if a user can access admin features (admin is now a regular role)
   */
  canAccessAdminFeatures(user: User): boolean {
    const activeUserSpec = new ActiveUserSpecification();
    const adminUserSpec = new AdminUserSpecification();
    const completeAccountSpec = new CompleteUserAccountSpecification();

    // Combine specifications: user must be active, have admin role, and complete account
    const adminAccessSpec = activeUserSpec.and(adminUserSpec).and(completeAccountSpec);

    return adminAccessSpec.isSatisfiedBy(user);
  }

  /**
   * Check if a user can access root features (highest privilege level)
   */
  canAccessRootFeatures(user: User): boolean;
  canAccessRootFeatures(user: IUserAuthInfo): boolean;
  canAccessRootFeatures(user: User | IUserAuthInfo): boolean {
    // Check if user is active
    if (!user.isActive) {
      return false;
    }

    // For lightweight checks, use permission-based approach
    if ('hasPermission' in user && typeof user.hasPermission === 'function') {
      return user.hasPermission('root:access');
    }

    // For full User entities, use specifications
    const activeUserSpec = new ActiveUserSpecification();
    const rootUserSpec = new RootLevelUserSpecification();
    const completeAccountSpec = new CompleteUserAccountSpecification();

    // Combine specifications: user must be active, have root level role, and complete account
    const rootAccessSpec = activeUserSpec.and(rootUserSpec).and(completeAccountSpec);

    return rootAccessSpec.isSatisfiedBy(user as User);
  }

  /**
   * Check if a user can perform sensitive operations (requires 2FA)
   */
  canPerformSensitiveOperations(user: User): boolean;
  canPerformSensitiveOperations(user: IUserAuthInfo): boolean;
  canPerformSensitiveOperations(user: User | IUserAuthInfo): boolean {
    // Check if user is active
    if (!user.isActive) {
      return false;
    }

    // For lightweight checks, use permission-based approach
    if ('hasPermission' in user && typeof user.hasPermission === 'function') {
      return user.hasPermission('sensitive:operations');
    }

    // For full User entities, use specifications
    const activeUserSpec = new ActiveUserSpecification();
    const twoFactorSpec = new TwoFactorEnabledSpecification();

    // Combine specifications: user must be active and have 2FA enabled
    const sensitiveOperationSpec = activeUserSpec.and(twoFactorSpec);

    return sensitiveOperationSpec.isSatisfiedBy(user as User);
  }

  /**
   * Check if a user can assign a specific role to another user
   */
  canAssignRole(assignerUser: User, targetUser: User, role: Role): boolean {
    // Check if the target user can receive this role
    const canAssignRoleSpec = new CanAssignRoleSpecification(role);
    if (!canAssignRoleSpec.isSatisfiedBy(targetUser)) {
      return false;
    }

    // Additional rule: only root users can assign root level roles
    const rootRoleSpec = new RootLevelRoleSpecification();
    if (rootRoleSpec.isSatisfiedBy(role)) {
      return this.canAccessRootFeatures(assignerUser);
    }

    // Admin and other regular roles can be assigned by root or admin users
    return this.canAccessRootFeatures(assignerUser) || this.canAccessAdminFeatures(assignerUser);
  }

  /**
   * Check if a user can delete a role
   */
  canDeleteRole(user: User, role: Role): boolean {
    // Cannot delete default roles
    const canDeleteSpec = new CanDeleteRoleSpecification();
    if (!canDeleteSpec.isSatisfiedBy(role)) {
      return false;
    }

    // Only root users can delete root level roles
    const rootRoleSpec = new RootLevelRoleSpecification();
    if (rootRoleSpec.isSatisfiedBy(role)) {
      // Root users have implicit permission to delete root level roles
      return this.canAccessRootFeatures(user);
    }

    // Root users have implicit permission, admin users need explicit permission
    if (this.canAccessRootFeatures(user)) {
      return true; // Root can delete any non-default role
    }

    // Admin users need explicit role:delete permission
    const hasDeletePermission = user.hasPermission('role:delete');

    return hasDeletePermission && this.canAccessAdminFeatures(user);
  }

  /**
   * Check if a user can access a specific resource
   */
  canAccessResource(user: User, resource: string, action: string): boolean;
  canAccessResource(user: IUserAuthInfo, resource: string, action: string): boolean;
  canAccessResource(user: User | IUserAuthInfo, resource: string, action: string): boolean {
    // Check if user is active
    if (!user.isActive) {
      return false;
    }

    // Build permission name from resource and action
    const permissionName = `${resource}:${action}`;

    // Check if user has the required permission
    return user.hasPermission(permissionName);
  }

  /**
   * Check if a user can become an admin
   */
  canBecomeAdmin(user: User): boolean {
    const activeUserSpec = new ActiveUserSpecification();
    const eligibleForAdminSpec = new EligibleForAdminRoleSpecification();
    const completeAccountSpec = new CompleteUserAccountSpecification();

    // Combine specifications for admin eligibility
    const adminEligibilitySpec = activeUserSpec.and(eligibleForAdminSpec).and(completeAccountSpec);

    return adminEligibilitySpec.isSatisfiedBy(user);
  }

  /**
   * Get security level for a user (for audit logging)
   */
  getUserSecurityLevel(user: User): 'low' | 'medium' | 'high' | 'critical' | 'maximum' {
    const activeUserSpec = new ActiveUserSpecification();
    const twoFactorSpec = new TwoFactorEnabledSpecification();
    const rootUserSpec = new RootLevelUserSpecification();
    const adminUserSpec = new AdminUserSpecification();

    if (!activeUserSpec.isSatisfiedBy(user)) {
      return 'low';
    }

    // Root users have maximum security level
    if (rootUserSpec.isSatisfiedBy(user)) {
      if (twoFactorSpec.isSatisfiedBy(user)) {
        return 'maximum';
      }

      return 'critical';
    }

    // Admin users have high security level
    if (adminUserSpec.isSatisfiedBy(user)) {
      if (twoFactorSpec.isSatisfiedBy(user)) {
        return 'critical';
      }

      return 'high';
    }

    if (twoFactorSpec.isSatisfiedBy(user)) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Check if user access should be logged (for compliance)
   */
  shouldLogAccess(user: User, resource: string): boolean {
    const rootUserSpec = new RootLevelUserSpecification();
    const adminUserSpec = new AdminUserSpecification();
    const sensitiveResources = ['user', 'role', 'permission', 'audit', 'system', 'company'];

    // Always log root user access (highest priority)
    if (rootUserSpec.isSatisfiedBy(user)) {
      return true;
    }

    // Always log admin user access
    if (adminUserSpec.isSatisfiedBy(user)) {
      return true;
    }

    // Log access to sensitive resources
    return sensitiveResources.includes(resource.toLowerCase());
  }
}
