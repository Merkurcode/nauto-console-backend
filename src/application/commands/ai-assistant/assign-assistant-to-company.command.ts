import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, BadRequestException, NotFoundException } from '@nestjs/common';
import { CompanyAIAssistant } from '@core/entities/company-ai-assistant.entity';
import { ICompanyAIAssistantRepository } from '@core/repositories/company-ai-assistant.repository.interface';
import { IAIAssistantRepository } from '@core/repositories/ai-assistant.repository.interface';
import { AssignAssistantFeatureDto } from '@application/dtos/ai-assistant/assign-assistant-to-company.dto';
import { REPOSITORY_TOKENS } from '@shared/constants/tokens';

export class AssignAssistantToCompanyCommand {
  constructor(
    public readonly companyId: string,
    public readonly aiAssistantId: string,
    public readonly enabled: boolean = true,
    public readonly features: AssignAssistantFeatureDto[] = [],
  ) {}
}

@CommandHandler(AssignAssistantToCompanyCommand)
export class AssignAssistantToCompanyCommandHandler
  implements ICommandHandler<AssignAssistantToCompanyCommand>
{
  constructor(
    @Inject(REPOSITORY_TOKENS.COMPANY_AI_ASSISTANT_REPOSITORY)
    private readonly companyAIAssistantRepository: ICompanyAIAssistantRepository,
    @Inject(REPOSITORY_TOKENS.AI_ASSISTANT_REPOSITORY)
    private readonly aiAssistantRepository: IAIAssistantRepository,
  ) {}

  async execute(command: AssignAssistantToCompanyCommand): Promise<CompanyAIAssistant> {
    // Verify assistant exists
    const assistant = await this.aiAssistantRepository.findById(command.aiAssistantId);
    if (!assistant) {
      throw new NotFoundException('AI Assistant not found');
    }

    // Validate feature IDs if provided
    if (command.features && command.features.length > 0) {
      await this.validateFeatureIds(command.aiAssistantId, command.features);
    }

    // Check if assignment already exists
    const existingAssignment =
      await this.companyAIAssistantRepository.findByCompanyIdAndAssistantId(
        command.companyId,
        command.aiAssistantId,
      );

    if (existingAssignment) {
      // Update existing assignment
      existingAssignment.updateEnabled(command.enabled);

      // Update features if provided
      if (command.features && command.features.length > 0) {
        // Keep existing features that aren't being updated, and add/update the provided ones
        const updatedFeatures = [...existingAssignment.features];

        command.features.forEach(newFeature => {
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
    const assignment = CompanyAIAssistant.create({
      id: crypto.randomUUID(),
      companyId: command.companyId,
      aiAssistantId: command.aiAssistantId,
      enabled: command.enabled,
      features: command.features.map(feature => ({
        id: crypto.randomUUID(),
        featureId: feature.featureId,
        enabled: feature.enabled,
      })),
    });

    return await this.companyAIAssistantRepository.create(assignment);
  }

  private async validateFeatureIds(
    aiAssistantId: string,
    features: AssignAssistantFeatureDto[],
  ): Promise<void> {
    // Get all available features for this assistant
    const assistant = await this.aiAssistantRepository.findByIdWithFeatures(aiAssistantId);
    if (!assistant) {
      throw new NotFoundException('AI Assistant not found');
    }

    const availableFeatureIds = assistant.features.map(f => f.id);

    // Check if all provided feature IDs are valid
    for (const feature of features) {
      if (!availableFeatureIds.includes(feature.featureId)) {
        throw new BadRequestException(`Invalid feature ID provided`);
      }
    }
  }
}
