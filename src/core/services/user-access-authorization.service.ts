import { Injectable, Inject, ForbiddenException } from '@nestjs/common';
import { User } from '@core/entities/user.entity';
import { ICompanyRepository } from '@core/repositories/company.repository.interface';
import { COMPANY_REPOSITORY } from '@shared/constants/tokens';
import { RolesEnum } from '@shared/constants/enums';
import { CompanyId } from '@core/value-objects/company-id.vo';

/**
 * Domain service for user access authorization
 * Handles company-based access control for user operations
 */
@Injectable()
export class UserAccessAuthorizationService {
  constructor(
    @Inject(COMPANY_REPOSITORY)
    private readonly companyRepository: ICompanyRepository,
  ) {}

  /**
   * Validates if current user can access target user based on role and company hierarchy
   */
  async validateUserAccess(currentUser: User, targetUser: User): Promise<void> {
    // Root users can access anyone
    if (this.hasRootAccess(currentUser)) {
      return;
    }

    const currentUserCompanyId = currentUser.companyId?.getValue();
    const targetUserCompanyId = targetUser.companyId?.getValue();

    if (!currentUserCompanyId) {
      throw new ForbiddenException('Current user must belong to a company');
    }

    if (!targetUserCompanyId) {
      throw new ForbiddenException('Target user must belong to a company');
    }

    // Admin users can ONLY access their company and child companies
    if (this.hasAdminAccess(currentUser)) {
      const hasAccess = await this.canAccessCompanyUser(currentUserCompanyId, targetUserCompanyId);
      if (!hasAccess) {
        throw new ForbiddenException(
          `Admin users can only access users from their company or child companies.`,
        );
      }

      return;
    }

    // Other roles (Manager, Sales Agent, Host, Guest) can only access their own profile
    const currentUserId = currentUser.id.getValue();
    const targetUserId = targetUser.id.getValue();

    if (currentUserId !== targetUserId) {
      throw new ForbiddenException('You can only access your own profile');
    }
  }

  /**
   * Check if user has root-level access
   */
  private hasRootAccess(user: User): boolean {
    return (
      user.rolesCollection.containsByName(RolesEnum.ROOT) ||
      user.rolesCollection.containsByName(RolesEnum.ROOT_READONLY)
    );
  }

  /**
   * Check if user has admin-level access
   */
  private hasAdminAccess(user: User): boolean {
    return user.rolesCollection.containsByName(RolesEnum.ADMIN);
  }

  /**
   * Check if current user can access target company user
   * Admin can ONLY access users from:
   * 1. Their own company (same companyId)
   * 2. Child companies (companies where parentCompany leads back to admin's company)
   * Supports recursive hierarchy checking for child companies
   */
  private async canAccessCompanyUser(
    currentUserCompanyId: string,
    targetUserCompanyId: string,
  ): Promise<boolean> {
    // Same company - admin can access users from their own company
    if (currentUserCompanyId === targetUserCompanyId) {
      return true;
    }

    // Check if target company is a child company of the current user's company
    const targetCompany = await this.companyRepository.findById(
      CompanyId.fromString(targetUserCompanyId),
    );
    if (!targetCompany) {
      // If target company doesn't exist, deny access
      return false;
    }

    // Get the parent company from target company
    const parentCompany = targetCompany.parentCompany;
    if (parentCompany) {
      const parentCompanyId = parentCompany.id.getValue();

      // If the parent company is the admin's company, allow access
      if (parentCompanyId === currentUserCompanyId) {
        return true;
      }

      // Check if it's a deeper hierarchy (recursively check parent companies)
      // This handles cases where: Admin Company -> Child Company -> Grandchild Company
      return await this.canAccessCompanyUser(currentUserCompanyId, parentCompanyId);
    }

    // No parent company relationship found, deny access
    return false;
  }
}
