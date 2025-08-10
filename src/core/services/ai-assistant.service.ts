import { Injectable, Inject } from '@nestjs/common';
import { IAIAssistantRepository } from '@core/repositories/ai-assistant.repository.interface';
import { ICompanyAIAssistantRepository } from '@core/repositories/company-ai-assistant.repository.interface';
import { AIAssistant } from '@core/entities/ai-assistant.entity';
import { CompanyAIAssistant } from '@core/entities/company-ai-assistant.entity';
import { CompanyId } from '@core/value-objects/company-id.vo';
import { AIAssistantId } from '@core/value-objects/ai-assistant-id.vo';
import {
  EntityNotFoundException,
  BusinessRuleValidationException,
} from '@core/exceptions/domain-exceptions';
import { REPOSITORY_TOKENS } from '@shared/constants/tokens';

@Injectable()
export class AIAssistantService {
  constructor(
    @Inject(REPOSITORY_TOKENS.AI_ASSISTANT_REPOSITORY)
    private readonly aiAssistantRepository: IAIAssistantRepository,
    @Inject(REPOSITORY_TOKENS.COMPANY_AI_ASSISTANT_REPOSITORY)
    private readonly companyAIAssistantRepository: ICompanyAIAssistantRepository,
  ) {}

  async assignAssistantToCompany(
    companyId: CompanyId,
    assistantId: AIAssistantId,
    isActive: boolean = true,
  ): Promise<CompanyAIAssistant> {
    // Verify assistant exists
    const assistant = await this.aiAssistantRepository.findById(assistantId.getValue());
    if (!assistant) {
      throw new EntityNotFoundException('AI Assistant', assistantId.getValue());
    }

    // Check if assignment already exists
    const existingAssignment =
      await this.companyAIAssistantRepository.findByCompanyIdAndAssistantId(
        companyId.getValue(),
        assistantId.getValue(),
      );

    if (existingAssignment) {
      throw new BusinessRuleValidationException(
        `Assistant ${assistant.name} is already assigned to this company`,
      );
    }

    // Create new assignment
    const companyAssistant = CompanyAIAssistant.create({
      id: crypto.randomUUID(),
      companyId: companyId.getValue(),
      aiAssistantId: assistantId.getValue(),
      enabled: isActive,
      features: [],
    });

    return await this.companyAIAssistantRepository.create(companyAssistant);
  }

  async toggleAssistantStatus(
    companyId: CompanyId,
    assistantId: AIAssistantId,
    isActive: boolean,
  ): Promise<CompanyAIAssistant> {
    // Find existing assignment
    const companyAssistant = await this.companyAIAssistantRepository.findByCompanyIdAndAssistantId(
      companyId.getValue(),
      assistantId.getValue(),
    );

    if (!companyAssistant) {
      throw new EntityNotFoundException(
        'Company AI Assistant assignment',
        `Company: ${companyId.getValue()}, Assistant: ${assistantId.getValue()}`,
      );
    }

    // Update status
    companyAssistant.updateEnabled(isActive);

    return await this.companyAIAssistantRepository.update(companyAssistant);
  }

  async toggleFeatureStatus(
    companyId: CompanyId,
    assistantId: AIAssistantId,
    featureName: string,
    isEnabled: boolean,
  ): Promise<CompanyAIAssistant> {
    // Find existing assignment
    const companyAssistant = await this.companyAIAssistantRepository.findByCompanyIdAndAssistantId(
      companyId.getValue(),
      assistantId.getValue(),
    );

    if (!companyAssistant) {
      throw new EntityNotFoundException(
        'Company AI Assistant assignment',
        `Company: ${companyId.getValue()}, Assistant: ${assistantId.getValue()}`,
      );
    }

    // Toggle feature
    companyAssistant.updateFeatureStatus(featureName, isEnabled);

    return await this.companyAIAssistantRepository.update(companyAssistant);
  }

  async getCompanyAssistants(companyId: CompanyId): Promise<CompanyAIAssistant[]> {
    return await this.companyAIAssistantRepository.findByCompanyId(companyId.getValue());
  }

  async getAvailableAssistants(): Promise<AIAssistant[]> {
    return await this.aiAssistantRepository.findAllAvailable();
  }

  async getCompanyAssistantWithFeatures(
    companyId: CompanyId,
    assistantId: AIAssistantId,
  ): Promise<CompanyAIAssistant | null> {
    return await this.companyAIAssistantRepository.findByCompanyIdAndAssistantId(
      companyId.getValue(),
      assistantId.getValue(),
    );
  }

  async assignAssistantToCompanyWithFeatures(
    companyId: CompanyId,
    assistantId: AIAssistantId,
    isActive: boolean,
    features: Array<{ featureId: string; enabled: boolean }> = [],
  ): Promise<CompanyAIAssistant> {
    // Verify assistant exists
    const assistant = await this.aiAssistantRepository.findById(assistantId.getValue());
    if (!assistant) {
      throw new EntityNotFoundException('AI Assistant', assistantId.getValue());
    }

    // Check if assignment already exists
    const existingAssignment =
      await this.companyAIAssistantRepository.findByCompanyIdAndAssistantId(
        companyId.getValue(),
        assistantId.getValue(),
      );

    if (existingAssignment) {
      // Update existing assignment
      existingAssignment.updateEnabled(isActive);

      // Update features if provided
      if (features.length > 0) {
        // Keep existing features that aren't being updated, and add/update the provided ones
        const updatedFeatures = [...existingAssignment.features];

        features.forEach(newFeature => {
          const existingFeatureIndex = updatedFeatures.findIndex(
            f => f.featureId === newFeature.featureId,
          );

          if (existingFeatureIndex >= 0) {
            // Update existing feature
            updatedFeatures[existingFeatureIndex] = {
              ...updatedFeatures[existingFeatureIndex],
              enabled: newFeature.enabled,
            };
          } else {
            // Add new feature
            updatedFeatures.push({
              id: crypto.randomUUID(),
              featureId: newFeature.featureId,
              enabled: newFeature.enabled,
            });
          }
        });

        existingAssignment.updateFeatures(updatedFeatures);
      }

      return await this.companyAIAssistantRepository.update(existingAssignment);
    }

    // Create new assignment
    const companyAssistant = CompanyAIAssistant.create({
      id: crypto.randomUUID(),
      companyId: companyId.getValue(),
      aiAssistantId: assistantId.getValue(),
      enabled: isActive,
      features: [],
    });

    // Add features if provided
    if (features.length > 0) {
      const featuresList = features.map(feature => ({
        id: crypto.randomUUID(),
        featureId: feature.featureId,
        enabled: feature.enabled,
      }));
      companyAssistant.updateFeatures(featuresList);
    }

    return await this.companyAIAssistantRepository.create(companyAssistant);
  }
}
