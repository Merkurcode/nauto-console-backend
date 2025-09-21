import { IQuery, QueryHandler, IQueryHandler, QueryBus } from '@nestjs/cqrs';
import { Injectable, Inject, Optional } from '@nestjs/common';
import { CompanyId } from '@core/value-objects/company-id.vo';
import { CompanyService } from '@core/services/company.service';
import { UserAuthorizationService } from '@core/services/user-authorization.service';
import { CompanyMapper } from '@application/mappers/company.mapper';
import { ICompanyResponse } from '@application/dtos/_responses/company/company.response';
import { ICompanyWeeklyScheduleResponse } from '@application/dtos/_responses/company-schedules/company-schedule.response.interface';
import { IAIPersonaResponse } from '@application/dtos/_responses/ai-persona/ai-persona.response.interface';
import { GetCompanyWeeklyScheduleQuery } from '../company-schedules/get-company-weekly-schedule.query';
import { GetCompanyActiveAIPersonaQuery } from '../ai-persona/get-company-active-ai-persona.query';
import { ILogger } from '@core/interfaces/logger.interface';
import { LOGGER_SERVICE } from '@shared/constants/tokens';

export class GetCompanySubsidiariesQuery implements IQuery {
  constructor(
    public readonly companyId: CompanyId,
    public readonly userId: string,
  ) {}
}

@Injectable()
@QueryHandler(GetCompanySubsidiariesQuery)
export class GetCompanySubsidiariesQueryHandler
  implements IQueryHandler<GetCompanySubsidiariesQuery>
{
  private readonly logger: ILogger;

  constructor(
    private readonly companyService: CompanyService,
    private readonly userAuthorizationService: UserAuthorizationService,
    private readonly queryBus: QueryBus,
    @Optional() @Inject(LOGGER_SERVICE) logger?: ILogger,
  ) {
    this.logger = logger?.setContext(GetCompanySubsidiariesQueryHandler.name);
  }

  async execute(query: GetCompanySubsidiariesQuery): Promise<ICompanyResponse[]> {
    // Get the user to check their authorization level
    const user = await this.userAuthorizationService.getCurrentUserSafely(query.userId);

    // Check if user has root-level access
    const canAccessRootFeatures = this.userAuthorizationService.canAccessRootFeatures(user);

    let subsidiaries;
    let assistantsMap;
    if (canAccessRootFeatures) {
      // Root users can see subsidiaries of any company
      const result = await this.companyService.getCompanySubsidiariesWithAssistants(
        query.companyId,
      );
      subsidiaries = result.subsidiaries;
      assistantsMap = result.assistantsMap;
    } else {
      const result = await this.companyService.getCompanySubsidiariesWithAssistants(
        query.companyId,
      );
      subsidiaries = result.subsidiaries;
      assistantsMap = result.assistantsMap;
    }

    // Fetch weekly schedules and active AI personas for all subsidiaries
    const weeklyScheduleMap = new Map<string, ICompanyWeeklyScheduleResponse>();
    const activeAIPersonaMap = new Map<string, IAIPersonaResponse | null>();

    await Promise.all(
      subsidiaries.map(async company => {
        const companyId = company.id.getValue();

        // Fetch weekly schedule
        try {
          const weeklySchedule = await this.queryBus.execute(
            new GetCompanyWeeklyScheduleQuery(companyId),
          );
          weeklyScheduleMap.set(companyId, weeklySchedule);
        } catch (error) {
          this.logger?.error(
            `Error fetching weekly schedule for company ${companyId}`,
            error?.stack,
            GetCompanySubsidiariesQueryHandler.name,
          );
        }

        // Fetch active AI persona
        try {
          const activeAIPersona = await this.queryBus.execute(
            new GetCompanyActiveAIPersonaQuery(companyId, null),
          );
          activeAIPersonaMap.set(companyId, activeAIPersona);
        } catch (error) {
          this.logger?.error(
            `Error fetching active AI persona for company ${companyId}`,
            error?.stack,
            GetCompanySubsidiariesQueryHandler.name,
          );
        }
      }),
    );

    return CompanyMapper.toListResponse(
      subsidiaries,
      assistantsMap,
      weeklyScheduleMap,
      activeAIPersonaMap,
    );
  }
}
