import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CompanyAIAssistant } from '@core/entities/company-ai-assistant.entity';
import { AssignAssistantFeatureDto } from '@application/dtos/ai-assistant/assign-assistant-to-company.dto';
import { AIAssistantResolverService } from '@core/services/ai-assistant-resolver.service';
import { AIAssistantService } from '@core/services/ai-assistant.service';
import { CompanyId } from '@core/value-objects/company-id.vo';
import { AIAssistantId } from '@core/value-objects/ai-assistant-id.vo';

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
    private readonly aiAssistantService: AIAssistantService,
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

    // Convert to value objects
    const companyId = CompanyId.fromString(resolvedCompanyId);
    const assistantId = AIAssistantId.fromString(resolvedAIAssistantId);

    // Use AIAssistantService to handle assignment with features
    return await this.aiAssistantService.assignAssistantToCompanyWithFeatures(
      companyId,
      assistantId,
      command.enabled,
      resolvedFeatures,
    );
  }
}
