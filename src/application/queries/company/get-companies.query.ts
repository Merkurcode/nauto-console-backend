import { IQuery, QueryHandler, IQueryHandler } from '@nestjs/cqrs';

export class GetCompaniesQuery implements IQuery {
  constructor(
    public readonly currentUserId: string,
    public readonly currentUserTenantId?: string | null,
  ) {}
}

import { Inject } from '@nestjs/common';
import { ICompanyRepository } from '@core/repositories/company.repository.interface';
import { IUserRepository } from '@core/repositories/user.repository.interface';
import { UserAuthorizationService } from '@core/services/user-authorization.service';
import { CompanyMapper } from '@application/mappers/company.mapper';
import { ICompanyResponse } from '@application/dtos/responses/company.response';
import { CompanyId } from '@core/value-objects/company-id.vo';
import { EntityNotFoundException } from '@core/exceptions/domain-exceptions';
import { COMPANY_REPOSITORY, USER_REPOSITORY } from '@shared/constants/tokens';

@QueryHandler(GetCompaniesQuery)
export class GetCompaniesQueryHandler implements IQueryHandler<GetCompaniesQuery> {
  constructor(
    @Inject(COMPANY_REPOSITORY)
    private readonly companyRepository: ICompanyRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    private readonly userAuthorizationService: UserAuthorizationService,
  ) {}

  async execute(query: GetCompaniesQuery): Promise<ICompanyResponse[]> {
    // Get current user for authorization
    const currentUser = await this.userRepository.findById(query.currentUserId);
    if (!currentUser) {
      throw new EntityNotFoundException('User', query.currentUserId);
    }

    // Business logic: Root users can see all companies, others only their own
    if (this.userAuthorizationService.canAccessRootFeatures(currentUser)) {
      // Root users can see all companies
      const { companies, assistantsMap } = await this.companyRepository.findAllWithAssistants();

      return CompanyMapper.toListResponse(companies, assistantsMap);
    } else {
      // Other users can only see their own company
      if (!query.currentUserTenantId) {
        return []; // No company assigned
      }

      const companyId = CompanyId.fromString(query.currentUserTenantId);
      const company = await this.companyRepository.findById(companyId);

      if (!company) {
        throw new EntityNotFoundException('Company', query.currentUserTenantId);
      }

      // Get assistants for this specific company
      const { assistantsMap } = await this.companyRepository.findAssistantsByCompanyId(companyId);

      return CompanyMapper.toListResponse([company], assistantsMap);
    }
  }
}
