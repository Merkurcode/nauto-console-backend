import { Injectable } from '@nestjs/common';
import { RolesEnum } from '@shared/constants/enums';

export interface IInvitationRule {
  canInvite: string[];
  cannotInvite: string[];
  requiresSameCompany: boolean;
}

@Injectable()
export class InvitationRulesService {
  private readonly rules: Map<string, IInvitationRule> = new Map([
    [
      RolesEnum.ROOT,
      {
        canInvite: [
          RolesEnum.ROOT,
          RolesEnum.ROOT_READONLY,
          RolesEnum.ADMIN,
          RolesEnum.MANAGER,
          RolesEnum.SALES_AGENT,
          RolesEnum.GUEST,
        ],
        cannotInvite: [],
        requiresSameCompany: false,
      },
    ],
    [
      RolesEnum.ROOT_READONLY,
      {
        canInvite: [], // Root readonly cannot invite anyone
        cannotInvite: [
          RolesEnum.ROOT,
          RolesEnum.ROOT_READONLY,
          RolesEnum.ADMIN,
          RolesEnum.MANAGER,
          RolesEnum.SALES_AGENT,
          RolesEnum.GUEST,
        ],
        requiresSameCompany: false,
      },
    ],
    [
      RolesEnum.ADMIN,
      {
        canInvite: [RolesEnum.ADMIN, RolesEnum.MANAGER, RolesEnum.SALES_AGENT, RolesEnum.GUEST],
        cannotInvite: [RolesEnum.ROOT, RolesEnum.ROOT_READONLY],
        requiresSameCompany: true,
      },
    ],
    [
      RolesEnum.MANAGER,
      {
        canInvite: [RolesEnum.MANAGER, RolesEnum.SALES_AGENT, RolesEnum.GUEST],
        cannotInvite: [RolesEnum.ROOT, RolesEnum.ROOT_READONLY, RolesEnum.ADMIN],
        requiresSameCompany: true,
      },
    ],
    [
      RolesEnum.SALES_AGENT,
      {
        canInvite: [],
        cannotInvite: [
          RolesEnum.ROOT,
          RolesEnum.ROOT_READONLY,
          RolesEnum.ADMIN,
          RolesEnum.MANAGER,
          RolesEnum.SALES_AGENT,
          RolesEnum.GUEST,
        ],
        requiresSameCompany: true,
      },
    ],
    [
      RolesEnum.GUEST,
      {
        canInvite: [],
        cannotInvite: [
          RolesEnum.ROOT,
          RolesEnum.ROOT_READONLY,
          RolesEnum.ADMIN,
          RolesEnum.MANAGER,
          RolesEnum.SALES_AGENT,
          RolesEnum.GUEST,
        ],
        requiresSameCompany: true,
      },
    ],
  ]);

  /**
   * Check if a user with given roles can invite a user with target roles
   */
  canInviteRole(inviterRoles: string[], targetRoles: string[]): boolean {
    // Get the highest privilege role of the inviter
    const inviterHighestRole = this.getHighestPrivilegeRole(inviterRoles);
    const rule = this.rules.get(inviterHighestRole);

    if (!rule) {
      return false;
    }

    // Check if any target role is explicitly forbidden
    for (const targetRole of targetRoles) {
      if (rule.cannotInvite.includes(targetRole)) {
        return false;
      }

      // Check if target role is in allowed list
      if (!rule.canInvite.includes(targetRole)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Check if the invitation requires same company validation
   */
  requiresSameCompany(inviterRoles: string[]): boolean {
    const inviterHighestRole = this.getHighestPrivilegeRole(inviterRoles);
    const rule = this.rules.get(inviterHighestRole);

    return rule?.requiresSameCompany ?? true;
  }

  /**
   * Get the maximum roles that a user can invite
   */
  getInvitableRoles(inviterRoles: string[]): string[] {
    const inviterHighestRole = this.getHighestPrivilegeRole(inviterRoles);
    const rule = this.rules.get(inviterHighestRole);

    return rule?.canInvite ?? [];
  }

  /**
   * Get roles that a user cannot invite
   */
  getForbiddenRoles(inviterRoles: string[]): string[] {
    const inviterHighestRole = this.getHighestPrivilegeRole(inviterRoles);
    const rule = this.rules.get(inviterHighestRole);

    return rule?.cannotInvite ?? [];
  }

  /**
   * Get the highest privilege role from a list of roles
   * Role hierarchy: root > root_readonly > admin > manager > sales_agent > guest
   */
  private getHighestPrivilegeRole(roles: string[]): string {
    const hierarchy = [
      RolesEnum.ROOT,
      RolesEnum.ROOT_READONLY,
      RolesEnum.ADMIN,
      RolesEnum.MANAGER,
      RolesEnum.SALES_AGENT,
      RolesEnum.GUEST,
    ];

    for (const role of hierarchy) {
      if (roles.includes(role)) {
        return role;
      }
    }

    return RolesEnum.GUEST; // Default to guest if no valid role found
  }

  /**
   * Validate invitation permissions with detailed error messages
   */
  validateInvitation(
    inviterRoles: string[],
    targetRoles: string[],
    inviterCompanyId?: string,
    targetCompanyId?: string,
  ): { isValid: boolean; error?: string } {
    // Check if inviter can invite at all
    const invitableRoles = this.getInvitableRoles(inviterRoles);
    if (invitableRoles.length === 0) {
      return {
        isValid: false,
        error: 'You do not have permission to invite users',
      };
    }

    // Check role permissions
    if (!this.canInviteRole(inviterRoles, targetRoles)) {
      const forbiddenRoles = this.getForbiddenRoles(inviterRoles);
      const invalidRoles = targetRoles.filter(role => forbiddenRoles.includes(role));

      return {
        isValid: false,
        error: `You cannot invite users with roles: ${invalidRoles.join(', ')}`,
      };
    }

    // Check company restrictions
    if (this.requiresSameCompany(inviterRoles) && inviterCompanyId !== targetCompanyId) {
      return {
        isValid: false,
        error: 'You can only invite users to your own company',
      };
    }

    return { isValid: true };
  }
}
