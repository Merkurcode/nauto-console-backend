import { Injectable, Inject, ConflictException, NotFoundException } from '@nestjs/common';
import {
  ICompanyRepository,
  IAssistantAssignment,
} from '@core/repositories/company.repository.interface';
import { Company } from '@core/entities/company.entity';
import { CompanyName } from '@core/value-objects/company-name.vo';
import { CompanyDescription } from '@core/value-objects/company-description.vo';
import { Address } from '@core/value-objects/address.vo';
import { Host } from '@core/value-objects/host.vo';
import { IndustrySector } from '@core/value-objects/industry-sector.value-object';
import { IndustryOperationChannel } from '@core/value-objects/industry-operation-channel.value-object';
import { CompanyId } from '@core/value-objects/company-id.vo';
import { UserId } from '@core/value-objects/user-id.vo';
import { IUserRepository } from '@core/repositories/user.repository.interface';
import { UserAuthorizationService } from '@core/services/user-authorization.service';
import { REPOSITORY_TOKENS } from '@shared/constants/tokens';
import {
  EntityNotFoundException,
  ForbiddenActionException,
} from '@core/exceptions/domain-exceptions';
import { ICompanyConfigAI } from '@core/interfaces/company-config-ai.interface';
import { IJwtPayload } from '@application/dtos/_responses/user/user.response';
import { User } from '@core/entities/user.entity';

@Injectable()
export class CompanyService {
  constructor(
    @Inject(REPOSITORY_TOKENS.COMPANY_REPOSITORY)
    private readonly companyRepository: ICompanyRepository,
    @Inject(REPOSITORY_TOKENS.USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    private readonly userAuthorizationService: UserAuthorizationService,
  ) {}

  async createCompany(
    name: CompanyName,
    description: CompanyDescription,
    address: Address,
    host: Host,
    timezone?: string,
    currency?: string,
    language?: string,
    logoUrl?: string,
    websiteUrl?: string,
    privacyPolicyUrl?: string,
    industrySector?: IndustrySector,
    industryOperationChannel?: IndustryOperationChannel,
    parentCompanyId?: CompanyId,
  ): Promise<Company> {
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
      address,
      host,
      timezone,
      currency,
      language,
      industrySector,
      industryOperationChannel,
      parentCompany,
      logoUrl,
      websiteUrl,
      privacyPolicyUrl,
    );

    // Save company
    return await this.companyRepository.save(company);
  }

  async updateCompany(
    companyId: CompanyId,
    currentUserId: string,
    updates: {
      name?: CompanyName;
      description?: CompanyDescription;
      address?: Address;
      host?: Host;
      timezone?: string;
      currency?: string;
      language?: string;
      logoUrl?: string;
      websiteUrl?: string;
      privacyPolicyUrl?: string;
      industrySector?: IndustrySector;
      industryOperationChannel?: IndustryOperationChannel;
      parentCompanyId?: CompanyId | null;
    },
  ): Promise<Company> {
    // Get current user for authorization
    const currentUser = await this.userRepository.findById(currentUserId);
    if (!currentUser) {
      throw new EntityNotFoundException('User', currentUserId);
    }

    // Find company
    const company = await this.companyRepository.findById(companyId);
    if (!company) {
      throw new EntityNotFoundException('Company', companyId.getValue());
    }

    // Authorization check: Root users can update any company, Admin users can only update their own company
    if (!this.userAuthorizationService.canAccessRootFeatures(currentUser)) {
      // Non-root users (Admin) can only update their own company
      if (!this.userAuthorizationService.canAccessCompany(currentUser, company.id.getValue())) {
        throw new ForbiddenActionException('Admin users can only update their own company');
      }
    }

    // Check for name conflicts if name is being updated
    if (updates.name && !updates.name.equals(company.name)) {
      const existingCompany = await this.companyRepository.findByName(updates.name);
      if (existingCompany && !existingCompany.id.equals(companyId)) {
        throw new ConflictException('Company name already exists');
      }
    }

    // Check for host conflicts if host is being updated
    if (updates.host && !updates.host.equals(company.host)) {
      const existingHostCompany = await this.companyRepository.findByHost(updates.host);
      if (existingHostCompany && !existingHostCompany.id.equals(companyId)) {
        throw new ConflictException('Company host already exists');
      }
    }

    // Handle parent company update
    if (updates.parentCompanyId !== undefined) {
      if (updates.parentCompanyId === null) {
        // Remove parent company
        company.removeFromParent();
      } else {
        // Set new parent company
        const parentCompany = await this.companyRepository.findById(updates.parentCompanyId);
        if (!parentCompany) {
          throw new EntityNotFoundException(
            'Parent company not found',
            updates.parentCompanyId.getValue(),
          );
        }
        company.setParentCompany(parentCompany);
      }
    }

    // Update company fields only if provided
    if (updates.name) company.updateName(updates.name);
    if (updates.description) company.updateDescription(updates.description);
    if (updates.address) company.updateAddress(updates.address);
    if (updates.host) company.updateHost(updates.host);
    if (updates.timezone !== undefined) company.updateTimezone(updates.timezone);
    if (updates.currency !== undefined) company.updateCurrency(updates.currency);
    if (updates.language !== undefined) company.updateLanguage(updates.language);
    if (updates.logoUrl !== undefined) company.updateLogoUrl(updates.logoUrl);
    if (updates.websiteUrl !== undefined) company.updateWebsiteUrl(updates.websiteUrl);
    if (updates.privacyPolicyUrl !== undefined)
      company.updatePrivacyPolicyUrl(updates.privacyPolicyUrl);
    if (updates.industrySector) company.updateIndustrySector(updates.industrySector);
    if (updates.industryOperationChannel)
      company.updateIndustryOperationChannel(updates.industryOperationChannel);

    // Save updated company
    return await this.companyRepository.update(company);
  }

  async deleteCompany(companyId: CompanyId): Promise<void> {
    // Find company
    const company = await this.companyRepository.findById(companyId);
    if (!company) {
      throw new EntityNotFoundException('Company', companyId.getValue());
    }

    // Check if company has users
    const users = await this.userRepository.findAllByCompanyId(companyId.getValue());
    if (users.length > 0) {
      throw new ConflictException('Cannot delete company with active users');
    }

    // Check if company has subsidiaries
    const subsidiaries = await this.companyRepository.findSubsidiaries(companyId);
    if (subsidiaries.length > 0) {
      throw new ConflictException('Cannot delete company with subsidiaries');
    }

    // Delete company
    await this.companyRepository.delete(companyId);
  }

  async assignUserToCompany(
    userId: UserId,
    companyId: CompanyId,
    currentUserId: UserId,
  ): Promise<void> {
    // Get current user using centralized method
    const currentUser = await this.userAuthorizationService.getCurrentUserSafely(
      currentUserId.getValue(),
    );

    // Verify target user exists
    const targetUser = await this.userRepository.findById(userId.getValue());
    if (!targetUser) {
      throw new EntityNotFoundException('User', userId.getValue());
    }

    // Verify company exists
    const company = await this.companyRepository.findById(companyId);
    if (!company) {
      throw new EntityNotFoundException('Company', companyId.getValue());
    }

    // Get current user's company if needed for validation
    const currentUserCompany = currentUser.companyId
      ? await this.companyRepository.findById(currentUser.companyId)
      : null;

    // Use domain service for complete validation (following Clean Architecture)
    const validationResult = this.userAuthorizationService.canAssignUserToCompanyWithValidation(
      currentUser,
      targetUser,
      company,
      currentUserCompany,
    );

    if (!validationResult.canAssign) {
      throw new ForbiddenActionException(
        `Cannot assign user to company. ${validationResult.reason}`,
      );
    }

    // Assign user to company (domain operation)
    targetUser.assignToCompany(companyId);

    // Save the changes (infrastructure operation)
    await this.userRepository.update(targetUser);
  }

  async removeUserFromCompany(userId: UserId, currentUserId: UserId): Promise<void> {
    // Get current user using centralized method
    const currentUser = await this.userAuthorizationService.getCurrentUserSafely(
      currentUserId.getValue(),
    );

    // Verify target user exists
    const targetUser = await this.userRepository.findById(userId.getValue());
    if (!targetUser) {
      throw new EntityNotFoundException('User', userId.getValue());
    }

    // Get current user's company if needed for validation
    const currentUserCompany = currentUser.companyId
      ? await this.companyRepository.findById(currentUser.companyId)
      : null;

    // Use domain service for complete validation (following Clean Architecture)
    const validationResult = this.userAuthorizationService.canRemoveUserFromCompanyWithValidation(
      currentUser,
      targetUser,
      currentUserCompany,
    );

    if (!validationResult.canRemove) {
      throw new ForbiddenActionException(
        `Cannot remove user from company. ${validationResult.reason}`,
      );
    }

    // Remove user from company (domain operation)
    targetUser.removeFromCompany();

    // Save the changes (infrastructure operation)
    await this.userRepository.update(targetUser);
  }

  async getCompanyById(companyId: CompanyId): Promise<Company> {
    const company = await this.companyRepository.findById(companyId);
    if (!company) {
      throw new EntityNotFoundException('Company', companyId.getValue());
    }

    return company;
  }

  async getCompanyByIdWithAssistants(
    companyId: CompanyId,
  ): Promise<{ company: Company; assistants: IAssistantAssignment[] }> {
    const { company, assistants } = await this.companyRepository.findByIdWithAssistants(companyId);
    if (!company) {
      throw new EntityNotFoundException('Company', companyId.getValue());
    }

    return { company, assistants };
  }

  async getCompanyByHost(host: Host): Promise<Company> {
    const company = await this.companyRepository.findByHost(host);
    if (!company) {
      throw new EntityNotFoundException('Company', `host: ${host.getValue()}`);
    }

    return company;
  }

  async getCompanyByHostWithAssistants(
    host: Host,
  ): Promise<{ company: Company; assistants: IAssistantAssignment[] }> {
    const company = await this.companyRepository.findByHost(host);
    if (!company) {
      throw new EntityNotFoundException('Company', `host: ${host.getValue()}`);
    }

    // Fetch assistants for this company
    const { assistantsMap } = await this.companyRepository.findAssistantsByCompanyId(company.id);
    const assistants = assistantsMap.get(company.id.getValue()) || [];

    return { company, assistants };
  }

  async getCompanyByName(name: CompanyName): Promise<Company | null> {
    return await this.companyRepository.findByName(name);
  }

  async getAllCompanies(): Promise<Company[]> {
    return await this.companyRepository.findAll();
  }

  async getRootCompanies(): Promise<Company[]> {
    return await this.companyRepository.findRootCompanies();
  }

  async getRootCompaniesWithAssistants(): Promise<{
    companies: Company[];
    assistantsMap: Map<string, IAssistantAssignment[]>;
  }> {
    const companies = await this.companyRepository.findRootCompanies();

    // Fetch assistants for all root companies
    const assistantsMap = new Map<string, IAssistantAssignment[]>();

    await Promise.all(
      companies.map(async company => {
        const { assistantsMap: companyAssistantsMap } =
          await this.companyRepository.findAssistantsByCompanyId(company.id);
        const assistants = companyAssistantsMap.get(company.id.getValue()) || [];
        if (assistants.length > 0) {
          assistantsMap.set(company.id.getValue(), assistants);
        }
      }),
    );

    return { companies, assistantsMap };
  }

  async getCompanySubsidiaries(companyId: CompanyId): Promise<Company[]> {
    const company = await this.companyRepository.findById(companyId);
    if (!company) {
      throw new EntityNotFoundException('Company', companyId.getValue());
    }

    return await this.companyRepository.findSubsidiaries(companyId);
  }

  async getCompanySubsidiariesWithAssistants(companyId: CompanyId): Promise<{
    subsidiaries: Company[];
    assistantsMap: Map<string, IAssistantAssignment[]>;
  }> {
    const company = await this.companyRepository.findById(companyId);
    if (!company) {
      throw new EntityNotFoundException('Company', companyId.getValue());
    }

    const subsidiaries = await this.companyRepository.findSubsidiaries(companyId);

    // Fetch assistants for all subsidiaries
    const assistantsMap = new Map<string, IAssistantAssignment[]>();

    await Promise.all(
      subsidiaries.map(async subsidiary => {
        const { assistantsMap: companyAssistantsMap } =
          await this.companyRepository.findAssistantsByCompanyId(subsidiary.id);
        const assistants = companyAssistantsMap.get(subsidiary.id.getValue()) || [];
        if (assistants.length > 0) {
          assistantsMap.set(subsidiary.id.getValue(), assistants);
        }
      }),
    );

    return { subsidiaries, assistantsMap };
  }

  async getCompanyHierarchy(companyId: CompanyId): Promise<Record<string, unknown>> {
    const company = await this.companyRepository.findById(companyId);
    if (!company) {
      throw new EntityNotFoundException('Company', companyId.getValue());
    }

    const subsidiaries = await this.companyRepository.findSubsidiaries(companyId);

    // Recursively get hierarchy for each subsidiary
    const subsidiaryHierarchies = await Promise.all(
      subsidiaries.map(async subsidiary => {
        return await this.getCompanyHierarchy(subsidiary.id);
      }),
    );

    return {
      company,
      subsidiaries: subsidiaryHierarchies,
    };
  }

  async getAllCompaniesWithAssistants(
    currentUserId: string,
  ): Promise<{ companies: Company[]; assistantsMap: Map<string, IAssistantAssignment[]> }> {
    // Get current user for authorization
    const currentUser = await this.userRepository.findById(currentUserId);
    if (!currentUser) {
      throw new EntityNotFoundException('User', currentUserId);
    }

    // Business logic: Root users can see all companies, others only their own
    if (this.userAuthorizationService.canAccessRootFeatures(currentUser)) {
      // Root users can see all companies
      return await this.companyRepository.findAllWithAssistants();
    } else {
      // Other users can only see their own company
      if (!currentUser.companyId) {
        return { companies: [], assistantsMap: new Map() }; // No company assigned
      }

      const companyId = CompanyId.fromString(currentUser.companyId.getValue());
      const company = await this.companyRepository.findById(companyId);

      if (!company) {
        throw new EntityNotFoundException('Company', currentUser.companyId.getValue());
      }

      // Get assistants for this specific company
      const { assistantsMap } = await this.companyRepository.findAssistantsByCompanyId(companyId);

      return { companies: [company], assistantsMap };
    }
  }

  async getCompanyWithHierarchy(companyId: CompanyId): Promise<Company> {
    const company = await this.companyRepository.findById(companyId);
    if (!company) {
      throw new EntityNotFoundException('Company', companyId.getValue());
    }

    // Get the root company to show the complete hierarchy
    return company.getRootCompany();
  }

  async getCompanyWithHierarchyAndAssistants(companyId: CompanyId): Promise<{
    rootCompany: Company;
    assistants: IAssistantAssignment[];
  }> {
    const company = await this.companyRepository.findById(companyId);
    if (!company) {
      throw new EntityNotFoundException('Company', companyId.getValue());
    }

    // Get the root company to show the complete hierarchy
    const rootCompany = company.getRootCompany();

    // Fetch assistants for the root company only (as per comment in query handler)
    const { assistantsMap } = await this.companyRepository.findAssistantsByCompanyId(
      rootCompany.id,
    );
    const assistants = assistantsMap.get(rootCompany.id.getValue()) || [];

    return { rootCompany, assistants };
  }

  // AI Configuration methods
  async createAIConfiguration(
    currentUser: IJwtPayload,
    companyId: string,
    config: ICompanyConfigAI,
  ): Promise<Company> {
    if (!this.userAuthorizationService.canAccessCompany(currentUser, companyId)) {
      throw new ForbiddenActionException('You cannot access this company');
    }

    const company = await this.companyRepository.findById(CompanyId.fromString(companyId));
    if (!company) {
      throw new EntityNotFoundException('Company not found', companyId);
    }

    // Validate company is active
    if (!company.isActive) {
      throw new ForbiddenActionException('Cannot create AI configuration for inactive company');
    }

    company.setAIConfiguration(config);

    return await this.companyRepository.update(company);
  }

  async updateAIConfiguration(
    currentUser: IJwtPayload,
    companyId: string,
    config: ICompanyConfigAI,
  ): Promise<Company> {
    if (!this.userAuthorizationService.canAccessCompany(currentUser, companyId)) {
      throw new ForbiddenActionException('You cannot access this company');
    }

    const company = await this.companyRepository.findById(CompanyId.fromString(companyId));
    if (!company) {
      throw new EntityNotFoundException('Company not found', companyId);
    }

    // Validate company is active
    if (!company.isActive) {
      throw new ForbiddenActionException('Cannot update AI configuration for inactive company');
    }

    // PUT operation: replace entire configuration
    company.updateAIConfiguration(config);

    return await this.companyRepository.update(company);
  }

  async deleteAIConfiguration(currentUser: IJwtPayload, companyId: string): Promise<void> {
    if (!this.userAuthorizationService.canAccessCompany(currentUser, companyId)) {
      throw new ForbiddenActionException('You cannot access this company');
    }

    const company = await this.companyRepository.findById(CompanyId.fromString(companyId));
    if (!company) {
      throw new EntityNotFoundException('Company not found', companyId);
    }

    // Validate company is active
    if (!company.isActive) {
      throw new ForbiddenActionException('Cannot delete AI configuration for inactive company');
    }

    company.removeAIConfiguration();
    await this.companyRepository.update(company);
  }

  async deactivateCompany(companyId: CompanyId, adminUser: User): Promise<Company> {
    const company = await this.companyRepository.findById(companyId);
    if (!company) {
      throw new EntityNotFoundException('Company', companyId.getValue());
    }

    if (!company.isActive) {
      throw new ConflictException('Company is already deactivated');
    }

    // Deactivate the company
    company.deactivate(adminUser);

    return await this.companyRepository.update(company);
  }
}
