import { IQuery, QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { CompanyId } from '@core/value-objects/company-id.vo';
import { CompanyService } from '@core/services/company.service';
import { CompanyMapper } from '@application/mappers/company.mapper';
import { ICompanyResponse } from '@application/dtos/_responses/company/company.response';

export class GetCompanySubsidiariesQuery implements IQuery {
  constructor(public readonly companyId: CompanyId) {}
}

@Injectable()
@QueryHandler(GetCompanySubsidiariesQuery)
export class GetCompanySubsidiariesQueryHandler
  implements IQueryHandler<GetCompanySubsidiariesQuery>
{
  constructor(private readonly companyService: CompanyService) {}

  async execute(query: GetCompanySubsidiariesQuery): Promise<ICompanyResponse[]> {
    const subsidiaries = await this.companyService.getCompanySubsidiaries(query.companyId);

    return CompanyMapper.toListResponse(subsidiaries);
  }
}
