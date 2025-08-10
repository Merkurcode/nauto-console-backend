import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { IAIAssistantRepository } from '@core/repositories/ai-assistant.repository.interface';
import { ICompanyRepository } from '@core/repositories/company.repository.interface';
import { CompanyName } from '@core/value-objects/company-name.vo';
import { CompanyId } from '@core/value-objects/company-id.vo';
import { REPOSITORY_TOKENS } from '@shared/constants/tokens';

@Injectable()
export class AIAssistantResolverService {
  constructor(
    @Inject(REPOSITORY_TOKENS.AI_ASSISTANT_REPOSITORY)
    private readonly aiAssistantRepository: IAIAssistantRepository,
    @Inject(REPOSITORY_TOKENS.COMPANY_REPOSITORY)
    private readonly companyRepository: ICompanyRepository,
  ) {}

  async resolveCompanyId(companyId?: string, companyName?: string): Promise<string> {
    if (!companyId && !companyName) {
      throw new NotFoundException('Either companyId or companyName must be provided');
    }

    if (companyId) {
      // If ID is provided, verify it exists
      const company = await this.companyRepository.findById(CompanyId.fromString(companyId));
      if (!company) {
        throw new NotFoundException('Company not found');
      }

      return companyId;
    }

    // Resolve by name
    const company = await this.companyRepository.findByName(new CompanyName(companyName!));
    if (!company) {
      throw new NotFoundException(`Company with name "${companyName}" not found`);
    }

    return company.id.getValue();
  }

  async resolveAIAssistantId(aiAssistantId?: string, aiAssistantName?: string): Promise<string> {
    if (!aiAssistantId && !aiAssistantName) {
      throw new NotFoundException('Either aiAssistantId or aiAssistantName must be provided');
    }

    if (aiAssistantId) {
      // If ID is provided, verify it exists
      const assistant = await this.aiAssistantRepository.findById(aiAssistantId);
      if (!assistant) {
        throw new NotFoundException('AI Assistant not found');
      }

      return aiAssistantId;
    }

    // Resolve by name
    const assistant = await this.aiAssistantRepository.findByName(aiAssistantName!);
    if (!assistant) {
      throw new NotFoundException(`AI Assistant with name "${aiAssistantName}" not found`);
    }

    return assistant.id;
  }

  async resolveFeatureId(
    aiAssistantId: string,
    featureId?: string,
    featureKeyName?: string,
  ): Promise<string> {
    if (!featureId && !featureKeyName) {
      throw new NotFoundException('Either featureId or featureKeyName must be provided');
    }

    if (featureId) {
      // If ID is provided, verify it exists for this assistant
      const assistant = await this.aiAssistantRepository.findByIdWithFeatures(aiAssistantId);
      if (!assistant) {
        throw new NotFoundException('AI Assistant not found');
      }

      const feature = assistant.features.find(f => f.id === featureId);
      if (!feature) {
        throw new NotFoundException('Feature not found for this AI Assistant');
      }

      return featureId;
    }

    // Resolve by keyName
    const assistant = await this.aiAssistantRepository.findByIdWithFeatures(aiAssistantId);
    if (!assistant) {
      throw new NotFoundException('AI Assistant not found');
    }

    const feature = assistant.features.find(f => f.keyName === featureKeyName);
    if (!feature) {
      throw new NotFoundException(
        `Feature with keyName "${featureKeyName}" not found for this AI Assistant`,
      );
    }

    return feature.id;
  }
}
