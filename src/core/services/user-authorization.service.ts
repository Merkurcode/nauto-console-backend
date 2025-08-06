import { Injectable, Inject } from '@nestjs/common';
import { User } from '@core/entities/user.entity';
import { Role } from '@core/entities/role.entity';
import { RolesEnum, ROLE_HIERARCHY_ORDER_STRINGS } from '@shared/constants/enums';
import { IUserRepository } from '@core/repositories/user.repository.interface';
import { USER_REPOSITORY } from '@shared/constants/tokens';
import { EntityNotFoundException } from '@core/exceptions/domain-exceptions';

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
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
  ) {}

  /**
   * Get current user safely with proper error handling
   * Centralizes the common pattern of fetching and validating current user
   */
  public async getCurrentUserSafely(userId: string): Promise<User> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new EntityNotFoundException('Current User', userId);
    }

    return user;
  }

  /**
   * Check if current user can access target user in the same company
   */
  public canAccessUserInSameCompany(currentUser: User, targetUser: User): boolean {
    return currentUser.companyId?.getValue() === targetUser.companyId?.getValue();
  }

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
    //if ('hasPermission' in user && typeof user.hasPermission === 'function') {
    //  return user.hasPermission('root:access');
    //}

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

  /**
   * Check if a user can query users from a specific company
   */
  canQueryCompanyUsers(user: User, companyId: string): boolean {
    const rootUserSpec = new RootLevelUserSpecification();
    const adminUserSpec = new AdminUserSpecification();

    // Root users can query any company
    if (rootUserSpec.isSatisfiedBy(user)) {
      return true;
    }

    // Admin users can only query their own company
    if (adminUserSpec.isSatisfiedBy(user)) {
      return user.companyId?.getValue() === companyId;
    }

    return false;
  }

  /**
   * Check if a user can edit another user
   */
  canEditUser(currentUser: User, targetUserId: string, targetUserCompanyId?: string): boolean {
    const rootUserSpec = new RootLevelUserSpecification();
    const adminUserSpec = new AdminUserSpecification();

    // Root can edit anyone
    if (rootUserSpec.isSatisfiedBy(currentUser)) {
      return true;
    }

    // Admin can edit users in their company
    if (adminUserSpec.isSatisfiedBy(currentUser)) {
      return currentUser.companyId?.getValue() === targetUserCompanyId;
    }

    // Others can only edit themselves
    return currentUser.id.getValue() === targetUserId;
  }

  /**
   * Check if a user can delete another user
   */
  canDeleteUser(currentUser: User, targetUser: User): boolean {
    const rootUserSpec = new RootLevelUserSpecification();
    const adminUserSpec = new AdminUserSpecification();

    // Root can delete anyone
    if (rootUserSpec.isSatisfiedBy(currentUser)) {
      return true;
    }

    // Check company boundaries for non-root users
    if (currentUser.companyId?.getValue() !== targetUser.companyId?.getValue()) {
      return false;
    }

    // Admin can delete non-admin users in their company
    if (adminUserSpec.isSatisfiedBy(currentUser)) {
      return !rootUserSpec.isSatisfiedBy(targetUser) && !adminUserSpec.isSatisfiedBy(targetUser);
    }

    // Manager can delete users below their hierarchy level
    if (currentUser.rolesCollection.containsByName(RolesEnum.MANAGER)) {
      return this.isUserBelowInHierarchy(currentUser, targetUser);
    }

    return false;
  }

  /**
   * Check if a user can activate/deactivate another user
   */
  canActivateUser(currentUser: User, targetUserCompanyId: string): boolean {
    const rootUserSpec = new RootLevelUserSpecification();
    const adminUserSpec = new AdminUserSpecification();

    // Root can activate anyone
    if (rootUserSpec.isSatisfiedBy(currentUser)) {
      return true;
    }

    // Admin can activate users in their company
    if (adminUserSpec.isSatisfiedBy(currentUser)) {
      return currentUser.companyId?.getValue() === targetUserCompanyId;
    }

    return false;
  }

  /**
   * Check if a user can assign roles to another user
   */
  canAssignRolesToUser(currentUser: User, targetUserCompanyId: string): boolean {
    const rootUserSpec = new RootLevelUserSpecification();
    const adminUserSpec = new AdminUserSpecification();

    // Root can assign roles to anyone
    if (rootUserSpec.isSatisfiedBy(currentUser)) {
      return true;
    }

    // Admin can assign roles to users in their company
    if (adminUserSpec.isSatisfiedBy(currentUser)) {
      return currentUser.companyId?.getValue() === targetUserCompanyId;
    }

    return false;
  }

  /**
   * Check if a user can remove a role from another user
   */
  canRemoveRoleFromUser(currentUser: User, targetUser: User, roleToRemove: Role): boolean {
    const rootUserSpec = new RootLevelUserSpecification();
    const adminUserSpec = new AdminUserSpecification();

    // Root can remove any role from any user
    if (rootUserSpec.isSatisfiedBy(currentUser)) {
      return true;
    }

    // Check company boundaries for non-root users
    const currentUserCompanyId = currentUser.companyId?.getValue();
    const targetUserCompanyId = targetUser.companyId?.getValue();

    if (currentUserCompanyId !== targetUserCompanyId) {
      return false;
    }

    // Admin can remove roles from users in their company
    if (adminUserSpec.isSatisfiedBy(currentUser)) {
      return true;
    }

    // Manager can remove roles from users in their company but not superior roles
    if (currentUser.rolesCollection.containsByName(RolesEnum.MANAGER)) {
      // Check if the role being removed is superior to manager
      const roleHierarchyLevel = this.getRoleHierarchyLevel(roleToRemove.name);
      const managerLevel = this.getRoleHierarchyLevel(RolesEnum.MANAGER);

      // Manager cannot remove roles that are equal or superior to their level (lower number = higher rank)
      return roleHierarchyLevel > managerLevel;
    }

    return false;
  }

  /**
   * Helper method to check hierarchy levels
   */
  private isUserBelowInHierarchy(currentUser: User, targetUser: User): boolean {
    const currentUserLevel = this.getUserHierarchyLevel(currentUser);
    const targetUserLevel = this.getUserHierarchyLevel(targetUser);

    return targetUserLevel > currentUserLevel;
  }

  /**
   * Check if current user can manage target user based on role hierarchy
   * Current user must have equal or higher hierarchy (lower number = higher hierarchy in 1-based system)
   */
  public canManageUser(currentUser: User, targetUser: User): boolean {
    const currentUserLevel = this.getUserHierarchyLevel(currentUser);
    const targetUserLevel = this.getUserHierarchyLevel(targetUser);

    return currentUserLevel <= targetUserLevel;
  }

  /**
   * Get user hierarchy level using the standard role hierarchy
   */
  public getUserHierarchyLevel(user: User): number {
    return this.getUserHierarchyLevelWithOrder(user, ROLE_HIERARCHY_ORDER_STRINGS);
  }

  /**
   * Get user hierarchy level
   */
  private getUserHierarchyLevelWithOrder(user: User, hierarchyOrder: readonly string[]): number {
    const userRoles = user.rolesCollection.getRoleNames().map(name => name.toLowerCase());

    for (let i = 0; i < hierarchyOrder.length; i++) {
      if (userRoles.some(role => role === hierarchyOrder[i])) {
        return i + 1;
      }
    }

    return hierarchyOrder.length + 1; // Default to lowest level if no role found
  }

  /**
   * Get role hierarchy level by role name (level starts at 1, not 0)
   */
  public getRoleHierarchyLevel(roleName: string): number {
    const hierarchyOrder = ROLE_HIERARCHY_ORDER_STRINGS;

    const roleIndex = hierarchyOrder.findIndex(
      role => role.toLowerCase() === roleName.toLowerCase(),
    );

    return roleIndex !== -1 ? roleIndex + 1 : hierarchyOrder.length + 1;
  }

  /**
   * Get role hierarchy level by role enum (level starts at 1, not 0)
   */
  public getRoleHierarchyLevelByEnum(role: RolesEnum): number {
    return this.getRoleHierarchyLevel(role);
  }
}
