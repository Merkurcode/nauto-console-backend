import { IQuery, QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CompanyId } from '@core/value-objects/company-id.vo';
import { ICompanyRepository } from '@core/repositories/company.repository.interface';
import { CompanyMapper } from '@application/mappers/company.mapper';
import { ICompanyResponse } from '@application/dtos/responses/company.response';
import { REPOSITORY_TOKENS } from '@shared/constants/tokens';

export class GetCompanyHierarchyQuery implements IQuery {
  constructor(public readonly companyId: CompanyId) {}
}

@Injectable()
@QueryHandler(GetCompanyHierarchyQuery)
export class GetCompanyHierarchyQueryHandler implements IQueryHandler<GetCompanyHierarchyQuery> {
  constructor(
    @Inject(REPOSITORY_TOKENS.COMPANY_REPOSITORY)
    private readonly companyRepository: ICompanyRepository,
  ) {}

  async execute(query: GetCompanyHierarchyQuery): Promise<ICompanyResponse> {
    const company = await this.companyRepository.findById(query.companyId);

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    // Get the root company first to show the complete hierarchy
    const rootCompany = company.getRootCompany();

    return CompanyMapper.toResponse(rootCompany);
  }
}
