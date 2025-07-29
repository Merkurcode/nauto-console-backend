import { IQuery, QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject, Injectable } from '@nestjs/common';
import { ICompanyRepository } from '@core/repositories/company.repository.interface';
import { CompanyMapper } from '@application/mappers/company.mapper';
import { ICompanyResponse } from '@application/dtos/responses/company.response';
import { REPOSITORY_TOKENS } from '@shared/constants/tokens';

export class GetRootCompaniesQuery implements IQuery {}

@Injectable()
@QueryHandler(GetRootCompaniesQuery)
export class GetRootCompaniesQueryHandler implements IQueryHandler<GetRootCompaniesQuery> {
  constructor(
    @Inject(REPOSITORY_TOKENS.COMPANY_REPOSITORY)
    private readonly companyRepository: ICompanyRepository,
  ) {}

  async execute(query: GetRootCompaniesQuery): Promise<ICompanyResponse[]> {
    const rootCompanies = await this.companyRepository.findRootCompanies();

    return CompanyMapper.toListResponse(rootCompanies);
  }
}
