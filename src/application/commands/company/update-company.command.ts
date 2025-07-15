import { ICommand, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CompanyId } from '@core/value-objects/company-id.vo';
import { CompanyName } from '@core/value-objects/company-name.vo';
import { CompanyDescription } from '@core/value-objects/company-description.vo';
import { BusinessSector } from '@core/value-objects/business-sector.vo';
import { BusinessUnit } from '@core/value-objects/business-unit.vo';
import { Address } from '@core/value-objects/address.vo';
import { Host } from '@core/value-objects/host.vo';

export class UpdateCompanyCommand implements ICommand {
  constructor(
    public readonly id: CompanyId,
    public readonly name?: CompanyName,
    public readonly description?: CompanyDescription,
    public readonly businessSector?: BusinessSector,
    public readonly businessUnit?: BusinessUnit,
    public readonly address?: Address,
    public readonly host?: Host,
  ) {}
}

import { Inject, NotFoundException, ConflictException } from '@nestjs/common';
import { ICompanyRepository } from '@core/repositories/company.repository.interface';
import { CompanyMapper } from '@application/mappers/company.mapper';
import { ICompanyResponse } from '@application/dtos/responses/company.response';
import { REPOSITORY_TOKENS } from '@shared/constants/tokens';

@CommandHandler(UpdateCompanyCommand)
export class UpdateCompanyCommandHandler implements ICommandHandler<UpdateCompanyCommand> {
  constructor(
    @Inject(REPOSITORY_TOKENS.COMPANY_REPOSITORY)
    private readonly companyRepository: ICompanyRepository,
  ) {}

  async execute(command: UpdateCompanyCommand): Promise<ICompanyResponse> {
    const { id, name, description, businessSector, businessUnit, address, host } = command;

    // Find existing company
    const company = await this.companyRepository.findById(id);
    if (!company) {
      throw new NotFoundException('Company not found');
    }

    // Check if new name already exists (if name is being updated)
    if (name && !company.name.equals(name)) {
      const existingCompany = await this.companyRepository.findByName(name);
      if (existingCompany) {
        throw new ConflictException('Company name already exists');
      }
    }

    // Check if new host already exists (if host is being updated)
    if (host && !company.host.equals(host)) {
      const existingHostCompany = await this.companyRepository.findByHost(host);
      if (existingHostCompany) {
        throw new ConflictException('Company host already exists');
      }
    }

    // Update company
    company.updateCompanyInfo(name, description, businessSector, businessUnit, address, host);

    // Save updated company
    const updatedCompany = await this.companyRepository.update(company);

    // Return mapped response
    return CompanyMapper.toResponse(updatedCompany);
  }
}
