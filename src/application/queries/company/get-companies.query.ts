import { IQuery, QueryHandler, IQueryHandler } from '@nestjs/cqrs';

export class GetCompaniesQuery implements IQuery {}

import { Inject } from '@nestjs/common';
import { ICompanyRepository } from '@core/repositories/company.repository.interface';
import { CompanyMapper } from '@application/mappers/company.mapper';
import { ICompanyResponse } from '@application/dtos/responses/company.response';
import { COMPANY_REPOSITORY } from '@shared/constants/tokens';

@QueryHandler(GetCompaniesQuery)
export class GetCompaniesQueryHandler implements IQueryHandler<GetCompaniesQuery> {
  constructor(
    @Inject(COMPANY_REPOSITORY)
    private readonly companyRepository: ICompanyRepository,
  ) {}

  async execute(): Promise<ICompanyResponse[]> {
    const companies = await this.companyRepository.findAll();

    return companies.map(company => CompanyMapper.toResponse(company));
  }
}
