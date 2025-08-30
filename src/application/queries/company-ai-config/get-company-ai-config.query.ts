import { IQuery, QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { ICompanyRepository } from '@core/repositories/company.repository.interface';
import { REPOSITORY_TOKENS } from '@shared/constants/tokens';
import { ICompanyAIConfigResponse } from '@application/dtos/_responses/company-ai-config/company-ai-config.response.interface';
import {
  EntityNotFoundException,
  ForbiddenActionException,
} from '@core/exceptions/domain-exceptions';
import { CompanyId } from '@core/value-objects/company-id.vo';
import { UserAuthorizationService } from '@core/services/user-authorization.service';
import { IJwtPayload } from '@application/dtos/_responses/user/user.response';

/**
 * Query for retrieving company AI configuration
 * Following Clean Architecture: Application layer queries for read operations
 */
export class GetCompanyAIConfigQuery implements IQuery {
  constructor(
    public readonly companyId: string,
    public readonly currentUser: IJwtPayload,
  ) {}
}

/**
 * Query handler for retrieving company AI configuration
 * Following Clean Architecture: Queries can use repositories directly for simple read operations
 */
@QueryHandler(GetCompanyAIConfigQuery)
export class GetCompanyAIConfigHandler
  implements IQueryHandler<GetCompanyAIConfigQuery, ICompanyAIConfigResponse>
{
  constructor(
    @Inject(REPOSITORY_TOKENS.COMPANY_REPOSITORY)
    private readonly companyRepository: ICompanyRepository,
    private readonly userAuthorizationService: UserAuthorizationService,
  ) {}

  async execute(query: GetCompanyAIConfigQuery): Promise<ICompanyAIConfigResponse> {
    const { companyId, currentUser } = query;

    if (!this.userAuthorizationService.canAccessCompany(currentUser, companyId)) {
      throw new ForbiddenActionException('You cannot access this company');
    }

    const company = await this.companyRepository.findById(CompanyId.fromString(companyId));
    if (!company) {
      throw new EntityNotFoundException('Company not found', companyId);
    }

    return {
      companyId: company.id.getValue(),
      hasConfiguration: company.configAI !== null,
      lastUpdated: company.lastUpdated?.toISOString(),
      welcomeMessage: company.configAI?.welcomeMessage,
      temperature: company.configAI?.temperature,
      responseInstructions: company.configAI?.responseInstructions,
      clientDiscoveryInstructions: company.configAI?.clientDiscoveryInstructions,
    };
  }
}
