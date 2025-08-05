import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, BadRequestException, NotFoundException } from '@nestjs/common';
import { CompanyAIAssistant } from '@core/entities/company-ai-assistant.entity';
import { ICompanyAIAssistantRepository } from '@core/repositories/company-ai-assistant.repository.interface';
import { IAIAssistantRepository } from '@core/repositories/ai-assistant.repository.interface';
import { AssignAssistantFeatureDto } from '@application/dtos/ai-assistant/assign-assistant-to-company.dto';
import { AIAssistantResolverService } from '@application/services/ai-assistant-resolver.service';
import { REPOSITORY_TOKENS } from '@shared/constants/tokens';

export class AssignAssistantToCompanyCommand {
  constructor(
    public readonly companyId: string | undefined,
    public readonly companyName: string | undefined,
    public readonly aiAssistantId: string | undefined,
    public readonly aiAssistantName: string | undefined,
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
    private readonly resolverService: AIAssistantResolverService,
  ) {}

  async execute(command: AssignAssistantToCompanyCommand): Promise<CompanyAIAssistant> {
    // Resolve company and AI assistant IDs
    const resolvedCompanyId = await this.resolverService.resolveCompanyId(
      command.companyId,
      command.companyName,
    );
    const resolvedAIAssistantId = await this.resolverService.resolveAIAssistantId(
      command.aiAssistantId,
      command.aiAssistantName,
    );

    // Get assistant with features for validation
    const assistant = await this.aiAssistantRepository.findByIdWithFeatures(resolvedAIAssistantId);
    if (!assistant) {
      throw new NotFoundException('AI Assistant not found');
    }

    // Resolve and validate feature IDs if provided
    const resolvedFeatures: Array<{ featureId: string; enabled: boolean }> = [];
    if (command.features && command.features.length > 0) {
      for (const featureDto of command.features) {
        const resolvedFeatureId = await this.resolverService.resolveFeatureId(
          resolvedAIAssistantId,
          featureDto.featureId,
          featureDto.featureKeyName,
        );
        resolvedFeatures.push({
          featureId: resolvedFeatureId,
          enabled: featureDto.enabled,
        });
      }
    }

    // Check if assignment already exists
    const existingAssignment =
      await this.companyAIAssistantRepository.findByCompanyIdAndAssistantId(
        resolvedCompanyId,
        resolvedAIAssistantId,
      );

    if (existingAssignment) {
      // Update existing assignment
      existingAssignment.updateEnabled(command.enabled);

      // Update features if provided
      if (resolvedFeatures.length > 0) {
        // Keep existing features that aren't being updated, and add/update the provided ones
        const updatedFeatures = [...existingAssignment.features];

        resolvedFeatures.forEach(newFeature => {
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
      companyId: resolvedCompanyId,
      aiAssistantId: resolvedAIAssistantId,
      enabled: command.enabled,
      features: resolvedFeatures.map(feature => ({
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
