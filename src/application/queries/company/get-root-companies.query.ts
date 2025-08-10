import { IQuery, QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { CompanyService } from '@core/services/company.service';
import { CompanyMapper } from '@application/mappers/company.mapper';
import { ICompanyResponse } from '@application/dtos/_responses/company/company.response';

export class GetRootCompaniesQuery implements IQuery {}

@Injectable()
@QueryHandler(GetRootCompaniesQuery)
export class GetRootCompaniesQueryHandler implements IQueryHandler<GetRootCompaniesQuery> {
  constructor(private readonly companyService: CompanyService) {}

  async execute(_query: GetRootCompaniesQuery): Promise<ICompanyResponse[]> {
    const rootCompanies = await this.companyService.getRootCompanies();

    return CompanyMapper.toListResponse(rootCompanies);
  }
}
