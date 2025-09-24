import { IQuery, QueryHandler, IQueryHandler, QueryBus } from '@nestjs/cqrs';
import { Injectable, ForbiddenException, Inject, Optional } from '@nestjs/common';
import { CompanyId } from '@core/value-objects/company-id.vo';
import { CompanyService } from '@core/services/company.service';
import { UserAuthorizationService } from '@core/services/user-authorization.service';
import { CompanyMapper } from '@application/mappers/company.mapper';
import { ICompanyResponse } from '@application/dtos/_responses/company/company.response';
import { GetCompanyWeeklyScheduleQuery } from '../company-schedules/get-company-weekly-schedule.query';
import { GetCompanyActiveAIPersonaQuery } from '../ai-persona/get-company-active-ai-persona.query';
import { ILogger } from '@core/interfaces/logger.interface';
import { LOGGER_SERVICE, REPOSITORY_TOKENS } from '@shared/constants/tokens';
import { ICompanyRepository } from '@core/repositories/company.repository.interface';
import { IUserRepository } from '@core/repositories/user.repository.interface';
import { UserRoleHierarchyService } from '@core/services/user-role-hierarchy.service';
import { IJwtPayload } from '@application/dtos/_responses/user/user.response';
import { PRIVILEGED_ROLES } from '@shared/constants/enums';

export class GetCompanyHierarchyQuery implements IQuery {
  constructor(
    public readonly companyId: CompanyId,
    public readonly userId: string,
    public readonly currentUser?: IJwtPayload,
  ) {}
}

@Injectable()
@QueryHandler(GetCompanyHierarchyQuery)
export class GetCompanyHierarchyQueryHandler implements IQueryHandler<GetCompanyHierarchyQuery> {
  private readonly logger: ILogger;

  constructor(
    private readonly companyService: CompanyService,
    private readonly userAuthorizationService: UserAuthorizationService,
    private readonly queryBus: QueryBus,
    private readonly userRoleHierarchyService: UserRoleHierarchyService,
    @Inject(REPOSITORY_TOKENS.COMPANY_REPOSITORY)
    private readonly companyRepository: ICompanyRepository,
    @Inject(REPOSITORY_TOKENS.USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Optional() @Inject(LOGGER_SERVICE) logger?: ILogger,
  ) {
    this.logger = logger?.setContext(GetCompanyHierarchyQueryHandler.name);
  }

  async execute(query: GetCompanyHierarchyQuery): Promise<ICompanyResponse> {
    const rolesToExclude =
      query.currentUser && this.userRoleHierarchyService.hasPrivilegedRole(query.currentUser)
        ? []
        : PRIVILEGED_ROLES.map(r => r as string);

    // Get the user to check their authorization level
    const user = await this.userAuthorizationService.getCurrentUserSafely(query.userId);

    // Check if user has root-level access
    const canAccessRootFeatures = this.userAuthorizationService.canAccessRootFeatures(user);

    let rootCompany;
    let assistants;
    if (canAccessRootFeatures) {
      // Root users can see hierarchy of any company
      const result = await this.companyService.getCompanyWithHierarchyAndAssistants(
        query.companyId,
      );
      rootCompany = result.rootCompany;
      assistants = result.assistants;
    } else {
      // Non-root users can only see hierarchy of their own company
      if (!query.companyId) {
        throw new ForbiddenException('User has no associated company');
      }

      const result = await this.companyService.getCompanyWithHierarchyAndAssistants(
        query.companyId,
      );
      rootCompany = result.rootCompany;
      assistants = result.assistants;
    }

    // Fetch weekly schedule and active AI persona for the root company
    const companyId = rootCompany.id.getValue();

    let weeklySchedule;
    try {
      weeklySchedule = await this.queryBus.execute(new GetCompanyWeeklyScheduleQuery(companyId));
    } catch (error) {
      this.logger?.error(
        `Error fetching weekly schedule for company ${companyId}`,
        error?.stack,
        GetCompanyHierarchyQueryHandler.name,
      );
    }

    let activeAIPersona;
    try {
      activeAIPersona = await this.queryBus.execute(
        new GetCompanyActiveAIPersonaQuery(companyId, null),
      );
    } catch (error) {
      this.logger?.error(
        `Error fetching active AI persona for company ${companyId}`,
        error?.stack,
        GetCompanyHierarchyQueryHandler.name,
      );
    }

    // Get business units count
    let businessUnitsCount = 0;
    try {
      businessUnitsCount = await this.companyRepository.countSubsidiaries(
        CompanyId.fromString(companyId),
      );
    } catch (error) {
      this.logger?.error(
        `Error counting subsidiaries for company ${companyId}`,
        error?.stack,
        GetCompanyHierarchyQueryHandler.name,
      );
    }

    // Get total users count
    let totalUsersCount = 0;

    try {
      totalUsersCount = await this.userRepository.countByCompanyExcludingRoles(
        companyId,
        rolesToExclude,
      );
    } catch (error) {
      this.logger?.error(
        `Error counting users for company ${companyId}`,
        error?.stack,
        GetCompanyHierarchyQueryHandler.name,
      );
    }

    // For hierarchy response, we include schedules and AI persona only for the root company
    // Subsidiaries in the hierarchy will be basic responses
    return CompanyMapper.toResponse(
      rootCompany,
      assistants,
      weeklySchedule,
      activeAIPersona,
      businessUnitsCount,
      totalUsersCount,
    );
  }
}
