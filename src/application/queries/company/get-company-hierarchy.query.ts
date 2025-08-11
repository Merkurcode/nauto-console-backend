import { IQuery, QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Injectable, ForbiddenException } from '@nestjs/common';
import { CompanyId } from '@core/value-objects/company-id.vo';
import { CompanyService } from '@core/services/company.service';
import { UserAuthorizationService } from '@core/services/user-authorization.service';
import { CompanyMapper } from '@application/mappers/company.mapper';
import { ICompanyResponse } from '@application/dtos/_responses/company/company.response';

export class GetCompanyHierarchyQuery implements IQuery {
  constructor(
    public readonly companyId: CompanyId,
    public readonly userId: string,
    public readonly userTenantId?: string,
  ) {}
}

@Injectable()
@QueryHandler(GetCompanyHierarchyQuery)
export class GetCompanyHierarchyQueryHandler implements IQueryHandler<GetCompanyHierarchyQuery> {
  constructor(
    private readonly companyService: CompanyService,
    private readonly userAuthorizationService: UserAuthorizationService,
  ) {}

  async execute(query: GetCompanyHierarchyQuery): Promise<ICompanyResponse> {
    // Get the user to check their authorization level
    const user = await this.userAuthorizationService.getCurrentUserSafely(query.userId);

    // Check if user has root-level access
    const canAccessRootFeatures = this.userAuthorizationService.canAccessRootFeatures(user);

    if (canAccessRootFeatures) {
      // Root users can see hierarchy of any company
      const rootCompany = await this.companyService.getCompanyWithHierarchy(query.companyId);

      return CompanyMapper.toResponse(rootCompany);
    } else {
      // Non-root users can only see hierarchy of their own company
      if (!query.userTenantId) {
        throw new ForbiddenException('User has no associated company');
      }

      const userCompanyId = CompanyId.fromString(query.userTenantId);

      // Check if the requested company is the user's company
      if (!query.companyId.equals(userCompanyId)) {
        throw new ForbiddenException('You can only view hierarchy of your own company');
      }

      const rootCompany = await this.companyService.getCompanyWithHierarchy(query.companyId);

      return CompanyMapper.toResponse(rootCompany);
    }
  }
}
