import { IQuery, QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { CompanyId } from '@core/value-objects/company-id.vo';
import { CompanyService } from '@core/services/company.service';
import { CompanyMapper } from '@application/mappers/company.mapper';
import { ICompanyResponse } from '@application/dtos/_responses/company/company.response';

export class GetCompanyHierarchyQuery implements IQuery {
  constructor(public readonly companyId: CompanyId) {}
}

@Injectable()
@QueryHandler(GetCompanyHierarchyQuery)
export class GetCompanyHierarchyQueryHandler implements IQueryHandler<GetCompanyHierarchyQuery> {
  constructor(private readonly companyService: CompanyService) {}

  async execute(query: GetCompanyHierarchyQuery): Promise<ICompanyResponse> {
    // Get the root company to show the complete hierarchy
    const rootCompany = await this.companyService.getCompanyWithHierarchy(query.companyId);

    return CompanyMapper.toResponse(rootCompany);
  }
}
