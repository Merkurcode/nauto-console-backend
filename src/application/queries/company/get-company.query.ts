import { IQuery, QueryHandler, IQueryHandler, QueryBus } from '@nestjs/cqrs';
import { Injectable, Inject, Optional } from '@nestjs/common';
import { CompanyId } from '@core/value-objects/company-id.vo';
import { ILogger } from '@core/interfaces/logger.interface';
import { LOGGER_SERVICE } from '@shared/constants/tokens';

export class GetCompanyQuery implements IQuery {
  constructor(public readonly id: CompanyId) {}
}

import { CompanyService } from '@core/services/company.service';
import { CompanyMapper } from '@application/mappers/company.mapper';
import { ICompanyResponse } from '@application/dtos/_responses/company/company.response';
import { GetCompanyWeeklyScheduleQuery } from '../company-schedules/get-company-weekly-schedule.query';
import { GetCompanyActiveAIPersonaQuery } from '../ai-persona/get-company-active-ai-persona.query';

@Injectable()
@QueryHandler(GetCompanyQuery)
export class GetCompanyQueryHandler implements IQueryHandler<GetCompanyQuery> {
  private readonly logger: ILogger;

  constructor(
    private readonly companyService: CompanyService,
    private readonly queryBus: QueryBus,
    @Optional() @Inject(LOGGER_SERVICE) logger?: ILogger,
  ) {
    this.logger = logger?.setContext(GetCompanyQueryHandler.name);
  }

  async execute(query: GetCompanyQuery): Promise<ICompanyResponse> {
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

    return CompanyMapper.toResponse(company, assistants, weeklySchedule, activeAIPersona);
  }
}
