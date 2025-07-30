import { IQuery, QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { CompanyId } from '@core/value-objects/company-id.vo';

export class GetCompanyQuery implements IQuery {
  constructor(public readonly id: CompanyId) {}
}

import { Inject, NotFoundException } from '@nestjs/common';
import { ICompanyRepository } from '@core/repositories/company.repository.interface';
import { CompanyMapper } from '@application/mappers/company.mapper';
import { ICompanyResponse } from '@application/dtos/responses/company.response';
import { COMPANY_REPOSITORY } from '@shared/constants/tokens';

@QueryHandler(GetCompanyQuery)
export class GetCompanyQueryHandler implements IQueryHandler<GetCompanyQuery> {
  constructor(
    @Inject(COMPANY_REPOSITORY)
    private readonly companyRepository: ICompanyRepository,
  ) {}

  async execute(query: GetCompanyQuery): Promise<ICompanyResponse> {
    const { id } = query;

    const { company, assistants } = await this.companyRepository.findByIdWithAssistants(id);
    if (!company) {
      throw new NotFoundException('Company not found');
    }

    return CompanyMapper.toResponse(company, assistants);
  }
}
