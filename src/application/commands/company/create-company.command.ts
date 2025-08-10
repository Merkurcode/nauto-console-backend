import { ICommand, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CompanyName } from '@core/value-objects/company-name.vo';
import { CompanyDescription } from '@core/value-objects/company-description.vo';
import { Address } from '@core/value-objects/address.vo';
import { Host } from '@core/value-objects/host.vo';
import { IndustrySector } from '@core/value-objects/industry-sector.value-object';
import { IndustryOperationChannel } from '@core/value-objects/industry-operation-channel.value-object';
import { CompanyId } from '@core/value-objects/company-id.vo';

export class CreateCompanyCommand implements ICommand {
  constructor(
    public readonly name: CompanyName,
    public readonly description: CompanyDescription,
    public readonly address: Address,
    public readonly host: Host,
    public readonly timezone?: string,
    public readonly currency?: string,
    public readonly language?: string,
    public readonly logoUrl?: string,
    public readonly websiteUrl?: string,
    public readonly privacyPolicyUrl?: string,
    public readonly industrySector?: IndustrySector,
    public readonly industryOperationChannel?: IndustryOperationChannel,
    public readonly parentCompanyId?: CompanyId,
  ) {}
}

import { CompanyService } from '@core/services/company.service';
import { CompanyMapper } from '@application/mappers/company.mapper';
import { ICompanyResponse } from '@application/dtos/_responses/company/company.response';

@CommandHandler(CreateCompanyCommand)
export class CreateCompanyCommandHandler implements ICommandHandler<CreateCompanyCommand> {
  constructor(private readonly companyService: CompanyService) {}

  async execute(command: CreateCompanyCommand): Promise<ICompanyResponse> {
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
    } = command;

    // Use domain service to create company
    const company = await this.companyService.createCompany(
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
    );

    // Return mapped response
    return CompanyMapper.toResponse(company);
  }
}
