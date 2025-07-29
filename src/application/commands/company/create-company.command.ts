import { ICommand, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CompanyName } from '@core/value-objects/company-name.vo';
import { CompanyDescription } from '@core/value-objects/company-description.vo';
import { BusinessSector } from '@core/value-objects/business-sector.vo';
import { BusinessUnit } from '@core/value-objects/business-unit.vo';
import { Address } from '@core/value-objects/address.vo';
import { Host } from '@core/value-objects/host.vo';
import { IndustrySector } from '@core/value-objects/industry-sector.value-object';
import { IndustryOperationChannel } from '@core/value-objects/industry-operation-channel.value-object';
import { CompanyId } from '@core/value-objects/company-id.vo';

export class CreateCompanyCommand implements ICommand {
  constructor(
    public readonly name: CompanyName,
    public readonly description: CompanyDescription,
    public readonly businessSector: BusinessSector,
    public readonly businessUnit: BusinessUnit,
    public readonly address: Address,
    public readonly host: Host,
    public readonly industrySector?: IndustrySector,
    public readonly industryOperationChannel?: IndustryOperationChannel,
    public readonly parentCompanyId?: CompanyId,
  ) {}
}

import { Inject, ConflictException, NotFoundException } from '@nestjs/common';
import { ICompanyRepository } from '@core/repositories/company.repository.interface';
import { Company } from '@core/entities/company.entity';
import { CompanyMapper } from '@application/mappers/company.mapper';
import { ICompanyResponse } from '@application/dtos/responses/company.response';
import { REPOSITORY_TOKENS } from '@shared/constants/tokens';

@CommandHandler(CreateCompanyCommand)
export class CreateCompanyCommandHandler implements ICommandHandler<CreateCompanyCommand> {
  constructor(
    @Inject(REPOSITORY_TOKENS.COMPANY_REPOSITORY)
    private readonly companyRepository: ICompanyRepository,
  ) {}

  async execute(command: CreateCompanyCommand): Promise<ICompanyResponse> {
    const {
      name,
      description,
      businessSector,
      businessUnit,
      address,
      host,
      industrySector,
      industryOperationChannel,
      parentCompanyId,
    } = command;

    // Check if company name already exists
    const existingCompany = await this.companyRepository.findByName(name);
    if (existingCompany) {
      throw new ConflictException('Company name already exists');
    }

    // Check if host already exists
    const existingHostCompany = await this.companyRepository.findByHost(host);
    if (existingHostCompany) {
      throw new ConflictException('Company host already exists');
    }

    // Find parent company if parentCompanyId is provided
    let parentCompany: Company | undefined;
    if (parentCompanyId) {
      parentCompany = await this.companyRepository.findById(parentCompanyId);
      if (!parentCompany) {
        throw new NotFoundException('Parent company not found');
      }
    }

    // Create new company
    const company = Company.create(
      name,
      description,
      businessSector,
      businessUnit,
      address,
      host,
      industrySector,
      industryOperationChannel,
      parentCompany,
    );

    // Save company
    const savedCompany = await this.companyRepository.save(company);

    // Return mapped response
    return CompanyMapper.toResponse(savedCompany);
  }
}
