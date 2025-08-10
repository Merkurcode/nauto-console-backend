import { IQuery, QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { CompanyId } from '@core/value-objects/company-id.vo';

export class GetCompanyQuery implements IQuery {
  constructor(public readonly id: CompanyId) {}
}

import { CompanyService } from '@core/services/company.service';
import { CompanyMapper } from '@application/mappers/company.mapper';
import { ICompanyResponse } from '@application/dtos/_responses/company/company.response';

@QueryHandler(GetCompanyQuery)
export class GetCompanyQueryHandler implements IQueryHandler<GetCompanyQuery> {
  constructor(private readonly companyService: CompanyService) {}

  async execute(query: GetCompanyQuery): Promise<ICompanyResponse> {
    const { id } = query;

    const { company, assistants } = await this.companyService.getCompanyByIdWithAssistants(id);

    return CompanyMapper.toResponse(company, assistants);
  }
}
