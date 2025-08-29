import { ICommand, CommandHandler, ICommandHandler, QueryBus } from '@nestjs/cqrs';
import { Injectable, Inject, Optional } from '@nestjs/common';
import { CompanyId } from '@core/value-objects/company-id.vo';
import { CompanyName } from '@core/value-objects/company-name.vo';
import { CompanyDescription } from '@core/value-objects/company-description.vo';
import { Address } from '@core/value-objects/address.vo';
import { Host } from '@core/value-objects/host.vo';
import { IndustrySector } from '@core/value-objects/industry-sector.value-object';
import { IndustryOperationChannel } from '@core/value-objects/industry-operation-channel.value-object';
import { ILogger } from '@core/interfaces/logger.interface';
import { LOGGER_SERVICE, REPOSITORY_TOKENS } from '@shared/constants/tokens';
import { UpdateCompanyDto } from '@application/dtos/company/update-company.dto';

export class UpdateCompanyCommand implements ICommand {
  constructor(
    public readonly id: CompanyId,
    public readonly currentUserId: string,
    public readonly updateData: UpdateCompanyDto,
  ) {}
}

import { CompanyService } from '@core/services/company.service';
import { CompanyMapper } from '@application/mappers/company.mapper';
import { ICompanyResponse } from '@application/dtos/_responses/company/company.response';
import { GetCompanyWeeklyScheduleQuery } from '@application/queries/company-schedules/get-company-weekly-schedule.query';
import { GetCompanyActiveAIPersonaQuery } from '@application/queries/ai-persona/get-company-active-ai-persona.query';
import { GetCompanyQuery } from '@application/queries/company/get-company.query';
import { ICompanyRepository } from '@core/repositories/company.repository.interface';

@Injectable()
@CommandHandler(UpdateCompanyCommand)
export class UpdateCompanyCommandHandler implements ICommandHandler<UpdateCompanyCommand> {
  private readonly logger: ILogger;

  constructor(
    private readonly companyService: CompanyService,
    @Inject(REPOSITORY_TOKENS.COMPANY_REPOSITORY)
    private readonly companyRepository: ICompanyRepository,
    private readonly queryBus: QueryBus,
    @Optional() @Inject(LOGGER_SERVICE) logger?: ILogger,
  ) {
    this.logger = logger?.setContext(UpdateCompanyCommandHandler.name);
  }

  async execute(command: UpdateCompanyCommand): Promise<ICompanyResponse> {
    const { id, currentUserId, updateData } = command;

    // First, get the current company to merge with update data
    const currentCompany = await this.queryBus.execute(new GetCompanyQuery(id));

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
    } = updateData;

    // Merge address fields - use current values for undefined fields
    let mergedAddress: Address | undefined = undefined;
    if (address !== undefined) {
      const currentAddress = currentCompany.address;
      mergedAddress = new Address(
        address.country !== undefined ? address.country : currentAddress.country,
        address.state !== undefined ? address.state : currentAddress.state,
        address.city !== undefined ? address.city : currentAddress.city,
        address.street !== undefined ? address.street : currentAddress.street,
        address.exteriorNumber !== undefined
          ? address.exteriorNumber
          : currentAddress.exteriorNumber,
        address.postalCode !== undefined ? address.postalCode : currentAddress.postalCode,
        address.interiorNumber !== undefined
          ? address.interiorNumber
          : currentAddress.interiorNumber,
        address.googleMapsUrl !== undefined ? address.googleMapsUrl : currentAddress.googleMapsUrl,
      );
    }

    // Use domain service to update company with merged data
    const company = await this.companyService.updateCompany(id, currentUserId, {
      name: name !== undefined ? new CompanyName(name) : undefined,
      description: description !== undefined ? new CompanyDescription(description) : undefined,
      address: mergedAddress,
      host: host !== undefined ? new Host(host) : undefined,
      timezone,
      currency,
      language,
      logoUrl,
      websiteUrl,
      privacyPolicyUrl,
      industrySector:
        industrySector !== undefined ? IndustrySector.create(industrySector) : undefined,
      industryOperationChannel:
        industryOperationChannel !== undefined
          ? IndustryOperationChannel.create(industryOperationChannel)
          : undefined,
      parentCompanyId:
        parentCompanyId !== undefined
          ? parentCompanyId === null
            ? null
            : CompanyId.fromString(parentCompanyId)
          : undefined,
    });

    const companyId = company.id.getValue();

    // Fetch assistants for the updated company
    let assistants = [];
    try {
      const { assistantsMap } = await this.companyRepository.findAssistantsByCompanyId(company.id);
      assistants = assistantsMap.get(companyId) || [];
    } catch (error) {
      this.logger?.error(
        `Error fetching assistants for updated company ${companyId}`,
        error?.stack,
        UpdateCompanyCommandHandler.name,
      );
    }

    // Fetch weekly schedule for the company
    let weeklySchedule;
    try {
      weeklySchedule = await this.queryBus.execute(new GetCompanyWeeklyScheduleQuery(companyId));
    } catch (error) {
      this.logger?.error(
        `Error fetching weekly schedule for updated company ${companyId}`,
        error?.stack,
        UpdateCompanyCommandHandler.name,
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
        `Error fetching active AI persona for updated company ${companyId}`,
        error?.stack,
        UpdateCompanyCommandHandler.name,
      );
    }

    // Return complete mapped response
    return CompanyMapper.toResponse(company, assistants, weeklySchedule, activeAIPersona);
  }
}
