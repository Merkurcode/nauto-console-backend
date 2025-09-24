import { IQuery, QueryHandler, IQueryHandler, QueryBus } from '@nestjs/cqrs';
import { Injectable, Inject, Optional } from '@nestjs/common';
import { CompanyId } from '@core/value-objects/company-id.vo';
import { ILogger } from '@core/interfaces/logger.interface';
import { LOGGER_SERVICE, REPOSITORY_TOKENS } from '@shared/constants/tokens';
import { IJwtPayload } from '@application/dtos/_responses/user/user.response';

export class GetCompanyQuery implements IQuery {
  constructor(
    public readonly id: CompanyId,
    public readonly currentUser?: IJwtPayload,
  ) {}
}

import { CompanyService } from '@core/services/company.service';
import { CompanyMapper } from '@application/mappers/company.mapper';
import { ICompanyResponse } from '@application/dtos/_responses/company/company.response';
import { GetCompanyWeeklyScheduleQuery } from '../company-schedules/get-company-weekly-schedule.query';
import { GetCompanyActiveAIPersonaQuery } from '../ai-persona/get-company-active-ai-persona.query';
import { ICompanyRepository } from '@core/repositories/company.repository.interface';
import { IUserRepository } from '@core/repositories/user.repository.interface';
import { UserRoleHierarchyService } from '@core/services/user-role-hierarchy.service';
import { PRIVILEGED_ROLES } from '@shared/constants/enums';

@Injectable()
@QueryHandler(GetCompanyQuery)
export class GetCompanyQueryHandler implements IQueryHandler<GetCompanyQuery> {
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
    this.logger = logger?.setContext(GetCompanyQueryHandler.name);
  }

  async execute(query: GetCompanyQuery): Promise<ICompanyResponse> {
    const rolesToExclude =
      query.currentUser && this.userRoleHierarchyService.hasPrivilegedRole(query.currentUser)
        ? []
        : PRIVILEGED_ROLES.map(r => r as string);

    const { id } = query;

    const { company, assistants } = await this.companyService.getCompanyByIdWithAssistants(id);

    // Fetch weekly schedule for the company
    let weeklySchedule;
    try {
      weeklySchedule = await this.queryBus.execute(
        new GetCompanyWeeklyScheduleQuery(id.getValue()),
      );
    } catch (error) {
      this.logger?.error(
        `Error fetching weekly schedule for company ${id.getValue()}`,
        error?.stack,
        GetCompanyQueryHandler.name,
      );
    }

    // Fetch active AI persona for the company
    let activeAIPersona;
    try {
      activeAIPersona = await this.queryBus.execute(
        new GetCompanyActiveAIPersonaQuery(id.getValue(), null),
      );
    } catch (error) {
      this.logger?.error(
        `Error fetching active AI persona for company ${id.getValue()}`,
        error?.stack,
        GetCompanyQueryHandler.name,
      );
    }

    // Get business units count (subsidiaries)
    let businessUnitsCount = 0;
    try {
      businessUnitsCount = await this.companyRepository.countSubsidiaries(id);
    } catch (error) {
      this.logger?.error(
        `Error counting subsidiaries for company ${id.getValue()}`,
        error?.stack,
        GetCompanyQueryHandler.name,
      );
    }

    // Get total users count (excluding roles based on current user's privilege level)
    let totalUsersCount = 0;

    try {
      totalUsersCount = await this.userRepository.countByCompanyExcludingRoles(
        id.getValue(),
        rolesToExclude,
      );
    } catch (error) {
      this.logger?.error(
        `Error counting users for company ${id.getValue()}`,
        error?.stack,
        GetCompanyQueryHandler.name,
      );
    }

    return CompanyMapper.toResponse(
      company,
      assistants,
      weeklySchedule,
      activeAIPersona,
      businessUnitsCount,
      totalUsersCount,
    );
  }
}
