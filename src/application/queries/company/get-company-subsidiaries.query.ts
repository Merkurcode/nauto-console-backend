import { IQuery, QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { CompanyId } from '@core/value-objects/company-id.vo';
import { CompanyService } from '@core/services/company.service';
import { UserAuthorizationService } from '@core/services/user-authorization.service';
import { CompanyMapper } from '@application/mappers/company.mapper';
import { ICompanyResponse } from '@application/dtos/_responses/company/company.response';

export class GetCompanySubsidiariesQuery implements IQuery {
  constructor(
    public readonly companyId: CompanyId,
    public readonly userId: string,
    public readonly userTenantId?: string,
  ) {}
}

@Injectable()
@QueryHandler(GetCompanySubsidiariesQuery)
export class GetCompanySubsidiariesQueryHandler
  implements IQueryHandler<GetCompanySubsidiariesQuery>
{
  constructor(
    private readonly companyService: CompanyService,
    private readonly userAuthorizationService: UserAuthorizationService,
  ) {}

  async execute(query: GetCompanySubsidiariesQuery): Promise<ICompanyResponse[]> {
    // Get the user to check their authorization level
    const user = await this.userAuthorizationService.getCurrentUserSafely(query.userId);

    // Check if user has root-level access
    const canAccessRootFeatures = this.userAuthorizationService.canAccessRootFeatures(user);

    if (canAccessRootFeatures) {
      // Root users can see subsidiaries of any company
      const subsidiaries = await this.companyService.getCompanySubsidiaries(query.companyId);

      return CompanyMapper.toListResponse(subsidiaries);
    } else {
      // Non-root users can only see subsidiaries of their own company
      if (!query.userTenantId) {
        return []; // User has no tenant, return empty array
      }

      const userCompanyId = CompanyId.fromString(query.userTenantId);

      // Check if the requested company is the user's company
      if (!query.companyId.equals(userCompanyId)) {
        return []; // User can only see subsidiaries of their own company
      }

      const subsidiaries = await this.companyService.getCompanySubsidiaries(query.companyId);

      return CompanyMapper.toListResponse(subsidiaries);
    }
  }
}
