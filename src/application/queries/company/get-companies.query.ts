import { IQuery, QueryHandler, IQueryHandler, QueryBus } from '@nestjs/cqrs';
import { Injectable, Inject, Optional } from '@nestjs/common';

export class GetCompaniesQuery implements IQuery {
  constructor(
    public readonly currentUserId: string,
    public readonly currentUser?: IJwtPayload,
  ) {}
}

import { CompanyService } from '@core/services/company.service';
import { CompanyMapper } from '@application/mappers/company.mapper';
import { ICompanyResponse } from '@application/dtos/_responses/company/company.response';
import { ICompanyWeeklyScheduleResponse } from '@application/dtos/_responses/company-schedules/company-schedule.response.interface';
import { IAIPersonaResponse } from '@application/dtos/_responses/ai-persona/ai-persona.response.interface';
import { GetCompanyWeeklyScheduleQuery } from '../company-schedules/get-company-weekly-schedule.query';
import { GetCompanyActiveAIPersonaQuery } from '../ai-persona/get-company-active-ai-persona.query';
import { ILogger } from '@core/interfaces/logger.interface';
import { LOGGER_SERVICE, REPOSITORY_TOKENS } from '@shared/constants/tokens';
import { ICompanyRepository } from '@core/repositories/company.repository.interface';
import { IUserRepository } from '@core/repositories/user.repository.interface';
import { CompanyId } from '@core/value-objects/company-id.vo';
import { UserRoleHierarchyService } from '@core/services/user-role-hierarchy.service';
import { IJwtPayload } from '@application/dtos/_responses/user/user.response';
import { PRIVILEGED_ROLES } from '@shared/constants/enums';

@Injectable()
@QueryHandler(GetCompaniesQuery)
export class GetCompaniesQueryHandler implements IQueryHandler<GetCompaniesQuery> {
  private readonly logger: ILogger;

  constructor(
    private readonly companyService: CompanyService,
    private readonly queryBus: QueryBus,
    private readonly userRoleHierarchyService: UserRoleHierarchyService,
    @Inject(REPOSITORY_TOKENS.COMPANY_REPOSITORY)
    private readonly companyRepository: ICompanyRepository,
    @Inject(REPOSITORY_TOKENS.USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Optional() @Inject(LOGGER_SERVICE) logger?: ILogger,
  ) {
    this.logger = logger?.setContext(GetCompaniesQueryHandler.name);
  }

  async execute(query: GetCompaniesQuery): Promise<ICompanyResponse[]> {
    const rolesToExclude =
      query.currentUser && this.userRoleHierarchyService.hasPrivilegedRole(query.currentUser)
        ? []
        : PRIVILEGED_ROLES.map(r => r as string);

    const { companies, assistantsMap } = await this.companyService.getAllCompaniesWithAssistants(
      query.currentUserId,
    );

    // Fetch weekly schedules, active AI personas, and counts for all companies
    const weeklyScheduleMap = new Map<string, ICompanyWeeklyScheduleResponse>();
    const activeAIPersonaMap = new Map<string, IAIPersonaResponse | null>();
    const businessUnitsCountMap = new Map<string, number>();
    const totalUsersCountMap = new Map<string, number>();

    await Promise.all(
      companies.map(async company => {
        const companyId = company.id.getValue();

        // Fetch weekly schedule
        try {
          const weeklySchedule = await this.queryBus.execute(
            new GetCompanyWeeklyScheduleQuery(companyId),
          );
          weeklyScheduleMap.set(companyId, weeklySchedule);
        } catch (error) {
          // If there's an error fetching schedule, don't include it
          this.logger?.error(
            `Error fetching weekly schedule for company ${companyId}`,
            error?.stack,
            GetCompaniesQueryHandler.name,
          );
        }

        // Fetch active AI persona
        try {
          const activeAIPersona = await this.queryBus.execute(
            new GetCompanyActiveAIPersonaQuery(companyId, null),
          );
          activeAIPersonaMap.set(companyId, activeAIPersona);
        } catch (error) {
          // If there's an error fetching AI persona, don't include it
          this.logger?.error(
            `Error fetching active AI persona for company ${companyId}`,
            error?.stack,
            GetCompaniesQueryHandler.name,
          );
        }

        // Get business units count
        try {
          const count = await this.companyRepository.countSubsidiaries(
            CompanyId.fromString(companyId),
          );
          businessUnitsCountMap.set(companyId, count);
        } catch (error) {
          this.logger?.error(
            `Error counting subsidiaries for company ${companyId}`,
            error?.stack,
            GetCompaniesQueryHandler.name,
          );
        }

        // Get total users count
        try {
          const count = await this.userRepository.countByCompanyExcludingRoles(
            companyId,
            rolesToExclude,
          );
          totalUsersCountMap.set(companyId, count);
        } catch (error) {
          this.logger?.error(
            `Error counting users for company ${companyId}`,
            error?.stack,
            GetCompaniesQueryHandler.name,
          );
        }
      }),
    );

    return CompanyMapper.toListResponse(
      companies,
      assistantsMap,
      weeklyScheduleMap,
      activeAIPersonaMap,
      businessUnitsCountMap,
      totalUsersCountMap,
    );
  }
}
