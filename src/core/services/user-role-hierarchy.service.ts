import { Injectable } from '@nestjs/common';
import { User } from '@core/entities/user.entity';
import { RolesEnum, ROLE_HIERARCHY_ORDER, PRIVILEGED_ROLES_SET } from '@shared/constants/enums';
import { ForbiddenActionException } from '@core/exceptions/domain-exceptions';
import { IJwtPayload } from '@application/dtos/_responses/user/user.response';

@Injectable()
export class UserRoleHierarchyService {
  /**
   * Get the highest privilege level (lowest index) of a user's roles
   */
  private getUserHierarchyLevel(user: User): number {
    if (!user.roles || user.roles.length === 0) {
      return ROLE_HIERARCHY_ORDER.length + 1; // Lowest privilege
    }

    return user.roles.reduce((highestLevel, role) => {
      const roleIndex = ROLE_HIERARCHY_ORDER.indexOf(role.name as RolesEnum);
      // If role not found in hierarchy, treat as lowest privilege
      const effectiveIndex = roleIndex === -1 ? ROLE_HIERARCHY_ORDER.length + 1 : roleIndex + 1;

      return Math.min(highestLevel, effectiveIndex);
    }, ROLE_HIERARCHY_ORDER.length);
  }

  /**
   * Check if current user has higher or equal hierarchy level than target user
   */
  canModifyUser(currentUser: User, targetUser: User): boolean {
    const currentUserLevel = this.getUserHierarchyLevel(currentUser);
    const targetUserLevel = this.getUserHierarchyLevel(targetUser);

    // Lower index means higher privilege
    return currentUserLevel <= targetUserLevel;
  }

  /**
   * Check if user has privileged roles (ROOT, ROOT_READONLY, or BOT)
   */
  hasPrivilegedRole(user: User | IJwtPayload): boolean {
    if (!user || !user.roles || user.roles.length === 0) {
      return false;
    }

    return user.roles.some(role => PRIVILEGED_ROLES_SET.has(role.name as RolesEnum));
  }

  /**
   * Check if target user has privileged roles
   */
  isTargetUserPrivileged(targetUser: User | IJwtPayload): boolean {
    return this.hasPrivilegedRole(targetUser);
  }

  /**
   * Validate that current user can access target user for GET operations
   * - Cannot access ROOT/ROOT_READONLY/BOT users unless current user has same privileges
   * - Can only access self if target is privileged and current user is not
   */
  validateCanAccessUser(currentUser: User, targetUser: User): void {
    const currentUserPrivileged = this.hasPrivilegedRole(currentUser);
    const targetUserPrivileged = this.hasPrivilegedRole(targetUser);

    // If target user is privileged and current user is not privileged
    if (targetUserPrivileged && !currentUserPrivileged) {
      // Only allow access to self
      if (currentUser.id.getValue() !== targetUser.id.getValue()) {
        throw new ForbiddenActionException(
          'Cannot access privileged user information',
          'access-user',
          'user',
        );
      }
    }
  }

  /**
   * Validate that current user can modify target user
   * - Must have higher hierarchy level than target
   * - Cannot modify ROOT/ROOT_READONLY/BOT users unless current user is same user
   * - ROOT users can modify anyone except other ROOT users (unless same user)
   */
  validateCanModifyUser(currentUser: User, targetUser: User): void {
    //const _currentUserPrivileged = this.hasPrivilegedRole(currentUser);
    const targetUserPrivileged = this.hasPrivilegedRole(targetUser);
    const isSameUser = currentUser.id.equals(targetUser.id);

    // If target user is privileged
    if (targetUserPrivileged) {
      // Only allow modification if same user
      if (!isSameUser) {
        throw new ForbiddenActionException(
          'Cannot modify privileged users unless you are the same user',
          'modify-user',
          'user',
        );
      }
    } else {
      // For non-privileged target users, check hierarchy
      if (!this.canModifyUser(currentUser, targetUser)) {
        throw new ForbiddenActionException(
          'Insufficient hierarchy level to modify this user',
          'modify-user',
          'user',
        );
      }
    }
  }

  /**
   * Get role names for a user as RolesEnum array
   */
  getUserRoles(user: User): RolesEnum[] {
    if (!user.roles || user.roles.length === 0) {
      return [];
    }

    return user.roles.map(role => role.name as RolesEnum);
  }

  /**
   * Check if current user can delete target user
   * Same rules as modify but stricter for privileged users
   */
  validateCanDeleteUser(currentUser: User, targetUser: User): void {
    const targetUserPrivileged = this.hasPrivilegedRole(targetUser);
    //const _isSameUser = currentUser.id.equals(targetUser.id);

    // Cannot delete privileged users at all (even self)
    if (targetUserPrivileged) {
      throw new ForbiddenActionException(
        'Privileged users cannot be deleted',
        'delete-user',
        'user',
      );
    }

    // For non-privileged users, check hierarchy
    if (!this.canModifyUser(currentUser, targetUser)) {
      throw new ForbiddenActionException(
        'Insufficient hierarchy level to delete this user',
        'delete-user',
        'user',
      );
    }
  }
}
