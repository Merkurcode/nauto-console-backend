import { IQuery, QueryHandler, IQueryHandler, QueryBus } from '@nestjs/cqrs';
import { Injectable, Inject, Optional } from '@nestjs/common';

export class GetCompaniesQuery implements IQuery {
  constructor(
    public readonly currentUserId: string,
    public readonly currentUserTenantId?: string | null,
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
import { LOGGER_SERVICE } from '@shared/constants/tokens';

@Injectable()
@QueryHandler(GetCompaniesQuery)
export class GetCompaniesQueryHandler implements IQueryHandler<GetCompaniesQuery> {
  private readonly logger: ILogger;

  constructor(
    private readonly companyService: CompanyService,
    private readonly queryBus: QueryBus,
    @Optional() @Inject(LOGGER_SERVICE) logger?: ILogger,
  ) {
    this.logger = logger?.setContext(GetCompaniesQueryHandler.name);
  }

  async execute(query: GetCompaniesQuery): Promise<ICompanyResponse[]> {
    const { companies, assistantsMap } = await this.companyService.getAllCompaniesWithAssistants(
      query.currentUserId,
    );

    // Fetch weekly schedules and active AI personas for all companies
    const weeklyScheduleMap = new Map<string, ICompanyWeeklyScheduleResponse>();
    const activeAIPersonaMap = new Map<string, IAIPersonaResponse | null>();

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
      }),
    );

    return CompanyMapper.toListResponse(
      companies,
      assistantsMap,
      weeklyScheduleMap,
      activeAIPersonaMap,
    );
  }
}
