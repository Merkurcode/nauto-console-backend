import { ICommand, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CompanyId } from '@core/value-objects/company-id.vo';
import { CompanyName } from '@core/value-objects/company-name.vo';
import { CompanyDescription } from '@core/value-objects/company-description.vo';
import { Address } from '@core/value-objects/address.vo';
import { Host } from '@core/value-objects/host.vo';
import { IndustrySector } from '@core/value-objects/industry-sector.value-object';
import { IndustryOperationChannel } from '@core/value-objects/industry-operation-channel.value-object';

export class UpdateCompanyCommand implements ICommand {
  constructor(
    public readonly id: CompanyId,
    public readonly currentUserId: string,
    public readonly name?: CompanyName,
    public readonly description?: CompanyDescription,
    public readonly address?: Address,
    public readonly host?: Host,
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

import { Inject, NotFoundException, ConflictException } from '@nestjs/common';
import { ICompanyRepository } from '@core/repositories/company.repository.interface';
import { IUserRepository } from '@core/repositories/user.repository.interface';
import { UserAuthorizationService } from '@core/services/user-authorization.service';
import { CompanyMapper } from '@application/mappers/company.mapper';
import { ICompanyResponse } from '@application/dtos/responses/company.response';
import {
  EntityNotFoundException,
  ForbiddenActionException,
} from '@core/exceptions/domain-exceptions';
import { REPOSITORY_TOKENS } from '@shared/constants/tokens';

@CommandHandler(UpdateCompanyCommand)
export class UpdateCompanyCommandHandler implements ICommandHandler<UpdateCompanyCommand> {
  constructor(
    @Inject(REPOSITORY_TOKENS.COMPANY_REPOSITORY)
    private readonly companyRepository: ICompanyRepository,
    @Inject(REPOSITORY_TOKENS.USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    private readonly userAuthorizationService: UserAuthorizationService,
  ) {}

  async execute(command: UpdateCompanyCommand): Promise<ICompanyResponse> {
    const {
      id,
      currentUserId,
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

    // Get current user for authorization
    const currentUser = await this.userRepository.findById(currentUserId);
    if (!currentUser) {
      throw new EntityNotFoundException('User', currentUserId);
    }

    // Find existing company
    const company = await this.companyRepository.findById(id);
    if (!company) {
      throw new EntityNotFoundException('Company', id.getValue());
    }

    // Authorization check: Root users can update any company, Admin users can only update their own company
    if (!this.userAuthorizationService.canAccessRootFeatures(currentUser)) {
      // Non-root users (Admin) can only update their own company
      if (!this.userAuthorizationService.canAccessCompany(currentUser, company.id.getValue())) {
        throw new ForbiddenActionException('Admin users can only update their own company');
      }
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

    // Handle parent company update
    if (parentCompanyId !== undefined) {
      if (parentCompanyId === null) {
        // Remove parent company
        company.removeFromParent();
      } else {
        // Set new parent company
        const parentCompany = await this.companyRepository.findById(parentCompanyId);
        if (!parentCompany) {
          throw new NotFoundException('Parent company not found');
        }
        company.setParentCompany(parentCompany);
      }
    }

    // Update company
    company.updateCompanyInfo(
      name,
      description,
      address,
      host,
      industrySector,
      industryOperationChannel,
      timezone,
      currency,
      language,
      logoUrl,
      websiteUrl,
      privacyPolicyUrl,
    );

    // Save updated company
    const updatedCompany = await this.companyRepository.update(company);

    // Return mapped response
    return CompanyMapper.toResponse(updatedCompany);
  }
}
