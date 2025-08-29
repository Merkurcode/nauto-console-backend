import { IQuery, QueryHandler, IQueryHandler, QueryBus } from '@nestjs/cqrs';
import { Injectable, Inject, Optional } from '@nestjs/common';
import { Host } from '@core/value-objects/host.vo';

export class GetCompanyByHostQuery implements IQuery {
  constructor(public readonly host: Host) {}
}

import { CompanyService } from '@core/services/company.service';
import { CompanyMapper } from '@application/mappers/company.mapper';
import { ICompanyResponse } from '@application/dtos/_responses/company/company.response';
import { GetCompanyWeeklyScheduleQuery } from '../company-schedules/get-company-weekly-schedule.query';
import { GetCompanyActiveAIPersonaQuery } from '../ai-persona/get-company-active-ai-persona.query';
import { ILogger } from '@core/interfaces/logger.interface';
import { LOGGER_SERVICE } from '@shared/constants/tokens';

@Injectable()
@QueryHandler(GetCompanyByHostQuery)
export class GetCompanyByHostQueryHandler implements IQueryHandler<GetCompanyByHostQuery> {
  private readonly logger: ILogger;

  constructor(
    private readonly companyService: CompanyService,
    private readonly queryBus: QueryBus,
    @Optional() @Inject(LOGGER_SERVICE) logger?: ILogger,
  ) {
    this.logger = logger?.setContext(GetCompanyByHostQueryHandler.name);
  }

  async execute(query: GetCompanyByHostQuery): Promise<ICompanyResponse> {
    const { host } = query;

    const { company, assistants } = await this.companyService.getCompanyByHostWithAssistants(host);
    const companyId = company.id.getValue();

    // Fetch weekly schedule for the company
    let weeklySchedule;
    try {
      weeklySchedule = await this.queryBus.execute(new GetCompanyWeeklyScheduleQuery(companyId));
    } catch (error) {
      this.logger?.error(
        `Error fetching weekly schedule for company ${companyId}`,
        error?.stack,
        GetCompanyByHostQueryHandler.name,
      );
    }

    // Fetch active AI persona for the company
    let activeAIPersona;
    try {
      activeAIPersona = await this.queryBus.execute(
        new GetCompanyActiveAIPersonaQuery(companyId, null),
      );
    } catch (error) {
      this.logger?.error(
        `Error fetching active AI persona for company ${companyId}`,
        error?.stack,
        GetCompanyByHostQueryHandler.name,
      );
    }

    return CompanyMapper.toResponse(company, assistants, weeklySchedule, activeAIPersona);
  }
}
