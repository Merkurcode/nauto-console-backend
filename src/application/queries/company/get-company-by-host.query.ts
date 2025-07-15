import { IQuery, QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Host } from '@core/value-objects/host.vo';

export class GetCompanyByHostQuery implements IQuery {
  constructor(public readonly host: Host) {}
}

import { Inject, NotFoundException } from '@nestjs/common';
import { ICompanyRepository } from '@core/repositories/company.repository.interface';
import { CompanyMapper } from '@application/mappers/company.mapper';
import { ICompanyResponse } from '@application/dtos/responses/company.response';
import { REPOSITORY_TOKENS } from '@shared/constants/tokens';

@QueryHandler(GetCompanyByHostQuery)
export class GetCompanyByHostQueryHandler implements IQueryHandler<GetCompanyByHostQuery> {
  constructor(
    @Inject(REPOSITORY_TOKENS.COMPANY_REPOSITORY)
    private readonly companyRepository: ICompanyRepository,
  ) {}

  async execute(query: GetCompanyByHostQuery): Promise<ICompanyResponse> {
    const { host } = query;

    const company = await this.companyRepository.findByHost(host);
    if (!company) {
      throw new NotFoundException('Company not found');
    }

    return CompanyMapper.toResponse(company);
  }
}
