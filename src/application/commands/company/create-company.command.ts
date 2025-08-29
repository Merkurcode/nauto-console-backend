import { ICommand, CommandHandler, ICommandHandler, QueryBus } from '@nestjs/cqrs';
import { Injectable, Inject, Optional } from '@nestjs/common';
import { CompanyName } from '@core/value-objects/company-name.vo';
import { CompanyDescription } from '@core/value-objects/company-description.vo';
import { Address } from '@core/value-objects/address.vo';
import { Host } from '@core/value-objects/host.vo';
import { IndustrySector } from '@core/value-objects/industry-sector.value-object';
import { IndustryOperationChannel } from '@core/value-objects/industry-operation-channel.value-object';
import { CompanyId } from '@core/value-objects/company-id.vo';
import { ILogger } from '@core/interfaces/logger.interface';
import { LOGGER_SERVICE, REPOSITORY_TOKENS } from '@shared/constants/tokens';
import { CreateCompanyDto } from '@application/dtos/company/create-company.dto';

export class CreateCompanyCommand implements ICommand {
  constructor(public readonly createData: CreateCompanyDto) {}
}

import { CompanyService } from '@core/services/company.service';
import { CompanyMapper } from '@application/mappers/company.mapper';
import { ICompanyResponse } from '@application/dtos/_responses/company/company.response';
import { GetCompanyWeeklyScheduleQuery } from '@application/queries/company-schedules/get-company-weekly-schedule.query';
import { GetCompanyActiveAIPersonaQuery } from '@application/queries/ai-persona/get-company-active-ai-persona.query';
import { ICompanyRepository } from '@core/repositories/company.repository.interface';

@Injectable()
@CommandHandler(CreateCompanyCommand)
export class CreateCompanyCommandHandler implements ICommandHandler<CreateCompanyCommand> {
  private readonly logger: ILogger;

  constructor(
    private readonly companyService: CompanyService,
    @Inject(REPOSITORY_TOKENS.COMPANY_REPOSITORY)
    private readonly companyRepository: ICompanyRepository,
    private readonly queryBus: QueryBus,
    @Optional() @Inject(LOGGER_SERVICE) logger?: ILogger,
  ) {
    this.logger = logger?.setContext(CreateCompanyCommandHandler.name);
  }

  async execute(command: CreateCompanyCommand): Promise<ICompanyResponse> {
    const { createData } = command;

    const {
      name,
      description,
      address,
      host,
      timezone,
      currency,
      language,
      logoUrl,
      websiteUrl,
      privacyPolicyUrl,
      industrySector,
      industryOperationChannel,
      parentCompanyId,
    } = createData;

    // Create Value Objects from DTO data
    const companyName = new CompanyName(name);
    const companyDescription = new CompanyDescription(description);
    const companyAddress = new Address(
      address.country,
      address.state,
      address.city,
      address.street,
      address.exteriorNumber,
      address.postalCode,
      address.interiorNumber,
      address.googleMapsUrl,
    );
    const companyHost = new Host(host);
    const companyIndustrySector = industrySector
      ? IndustrySector.create(industrySector)
      : undefined;
    const companyIndustryOperationChannel = industryOperationChannel
      ? IndustryOperationChannel.create(industryOperationChannel)
      : undefined;
    const companyParentId = parentCompanyId ? CompanyId.fromString(parentCompanyId) : undefined;

    // Use domain service to create company
    const company = await this.companyService.createCompany(
      companyName,
      companyDescription,
      companyAddress,
      companyHost,
      timezone,
      currency,
      language,
      logoUrl,
      websiteUrl,
      privacyPolicyUrl,
      companyIndustrySector,
      companyIndustryOperationChannel,
      companyParentId,
    );

    const companyId = company.id.getValue();

    // Fetch assistants for the newly created company
    let assistants = [];
    try {
      const { assistantsMap } = await this.companyRepository.findAssistantsByCompanyId(company.id);
      assistants = assistantsMap.get(companyId) || [];
    } catch (error) {
      this.logger?.error(
        `Error fetching assistants for newly created company ${companyId}`,
        error?.stack,
        CreateCompanyCommandHandler.name,
      );
    }

    // Fetch weekly schedule for the company
    let weeklySchedule;
    try {
      weeklySchedule = await this.queryBus.execute(new GetCompanyWeeklyScheduleQuery(companyId));
    } catch (error) {
      this.logger?.error(
        `Error fetching weekly schedule for newly created company ${companyId}`,
        error?.stack,
        CreateCompanyCommandHandler.name,
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
        `Error fetching active AI persona for newly created company ${companyId}`,
        error?.stack,
        CreateCompanyCommandHandler.name,
      );
    }

    // Return complete mapped response
    return CompanyMapper.toResponse(company, assistants, weeklySchedule, activeAIPersona);
  }
}
