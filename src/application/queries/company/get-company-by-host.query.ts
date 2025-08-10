import { IQuery, QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Host } from '@core/value-objects/host.vo';

export class GetCompanyByHostQuery implements IQuery {
  constructor(public readonly host: Host) {}
}

import { CompanyService } from '@core/services/company.service';
import { CompanyMapper } from '@application/mappers/company.mapper';
import { ICompanyResponse } from '@application/dtos/_responses/company/company.response';

@QueryHandler(GetCompanyByHostQuery)
export class GetCompanyByHostQueryHandler implements IQueryHandler<GetCompanyByHostQuery> {
  constructor(private readonly companyService: CompanyService) {}

  async execute(query: GetCompanyByHostQuery): Promise<ICompanyResponse> {
    const { host } = query;

    const company = await this.companyService.getCompanyByHost(host);

    return CompanyMapper.toResponse(company);
  }
}
