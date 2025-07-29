import { IQuery, QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject, Injectable } from '@nestjs/common';
import { CompanyId } from '@core/value-objects/company-id.vo';
import { ICompanyRepository } from '@core/repositories/company.repository.interface';
import { CompanyMapper } from '@application/mappers/company.mapper';
import { ICompanyResponse } from '@application/dtos/responses/company.response';
import { REPOSITORY_TOKENS } from '@shared/constants/tokens';

export class GetCompanySubsidiariesQuery implements IQuery {
  constructor(public readonly companyId: CompanyId) {}
}

@Injectable()
@QueryHandler(GetCompanySubsidiariesQuery)
export class GetCompanySubsidiariesQueryHandler
  implements IQueryHandler<GetCompanySubsidiariesQuery>
{
  constructor(
    @Inject(REPOSITORY_TOKENS.COMPANY_REPOSITORY)
    private readonly companyRepository: ICompanyRepository,
  ) {}

  async execute(query: GetCompanySubsidiariesQuery): Promise<ICompanyResponse[]> {
    const subsidiaries = await this.companyRepository.findSubsidiaries(query.companyId);

    return CompanyMapper.toListResponse(subsidiaries);
  }
}
