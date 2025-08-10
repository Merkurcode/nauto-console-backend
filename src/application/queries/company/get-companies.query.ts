import { IQuery, QueryHandler, IQueryHandler } from '@nestjs/cqrs';

export class GetCompaniesQuery implements IQuery {
  constructor(
    public readonly currentUserId: string,
    public readonly currentUserTenantId?: string | null,
  ) {}
}

import { CompanyService } from '@core/services/company.service';
import { CompanyMapper } from '@application/mappers/company.mapper';
import { ICompanyResponse } from '@application/dtos/_responses/company/company.response';

@QueryHandler(GetCompaniesQuery)
export class GetCompaniesQueryHandler implements IQueryHandler<GetCompaniesQuery> {
  constructor(private readonly companyService: CompanyService) {}

  async execute(query: GetCompaniesQuery): Promise<ICompanyResponse[]> {
    const { companies, assistantsMap } = await this.companyService.getAllCompaniesWithAssistants(
      query.currentUserId,
    );

    return CompanyMapper.toListResponse(companies, assistantsMap);
  }
}
