import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { CompanyAIAssistant } from '@core/entities/company-ai-assistant.entity';
import { ICompanyAIAssistantRepository } from '@core/repositories/company-ai-assistant.repository.interface';
import { IAIAssistantRepository } from '@core/repositories/ai-assistant.repository.interface';
import { AIAssistantResolverService } from '@core/services/ai-assistant-resolver.service';
import { REPOSITORY_TOKENS } from '@shared/constants/tokens';

export class ToggleFeatureStatusCommand {
  constructor(
    public readonly companyId: string | undefined,
    public readonly companyName: string | undefined,
    public readonly aiAssistantId: string | undefined,
    public readonly aiAssistantName: string | undefined,
    public readonly featureId: string | undefined,
    public readonly featureKeyName: string | undefined,
    public readonly enabled: boolean,
  ) {}
}

@CommandHandler(ToggleFeatureStatusCommand)
export class ToggleFeatureStatusCommandHandler
  implements ICommandHandler<ToggleFeatureStatusCommand>
{
  constructor(
    @Inject(REPOSITORY_TOKENS.COMPANY_AI_ASSISTANT_REPOSITORY)
    private readonly companyAIAssistantRepository: ICompanyAIAssistantRepository,
    @Inject(REPOSITORY_TOKENS.AI_ASSISTANT_REPOSITORY)
    private readonly aiAssistantRepository: IAIAssistantRepository,
    private readonly resolverService: AIAssistantResolverService,
  ) {}

  async execute(command: ToggleFeatureStatusCommand): Promise<CompanyAIAssistant> {
    // Resolve company and AI assistant IDs
    const resolvedCompanyId = await this.resolverService.resolveCompanyId(
      command.companyId,
      command.companyName,
    );
    const resolvedAIAssistantId = await this.resolverService.resolveAIAssistantId(
      command.aiAssistantId,
      command.aiAssistantName,
    );

    // Resolve feature ID
    const resolvedFeatureId = await this.resolverService.resolveFeatureId(
      resolvedAIAssistantId,
      command.featureId,
      command.featureKeyName,
    );

    // Check if assignment exists
    let assignment = await this.companyAIAssistantRepository.findByCompanyIdAndAssistantId(
      resolvedCompanyId,
      resolvedAIAssistantId,
    );

    if (!assignment) {
      // Get assistant with features for new assignment creation
      const assistant =
        await this.aiAssistantRepository.findByIdWithFeatures(resolvedAIAssistantId);
      if (!assistant) {
        throw new NotFoundException('AI Assistant not found');
      }

      // Create new assignment with all features disabled by default, except the target feature
      const features = assistant.features.map(feature => ({
        id: crypto.randomUUID(),
        featureId: feature.id,
        enabled: feature.id === resolvedFeatureId ? command.enabled : false,
      }));

      assignment = CompanyAIAssistant.create({
        id: crypto.randomUUID(),
        companyId: resolvedCompanyId,
        aiAssistantId: resolvedAIAssistantId,
        enabled: true, // Enable the assistant when creating for feature toggle
        features,
      });

      return await this.companyAIAssistantRepository.create(assignment);
    }

    // Check if feature already exists in assignment
    const existingFeatureIndex = assignment.features.findIndex(
      f => f.featureId === resolvedFeatureId,
    );

    if (existingFeatureIndex >= 0) {
      // Update existing feature
      const updatedFeatures = [...assignment.features];
      updatedFeatures[existingFeatureIndex] = {
        ...updatedFeatures[existingFeatureIndex],
        enabled: command.enabled,
      };
      assignment.updateFeatures(updatedFeatures);
    } else {
      // Add new feature
      const updatedFeatures = [
        ...assignment.features,
        {
          id: crypto.randomUUID(),
          featureId: resolvedFeatureId,
          enabled: command.enabled,
        },
      ];
      assignment.updateFeatures(updatedFeatures);
    }

    return await this.companyAIAssistantRepository.update(assignment);
  }
}
