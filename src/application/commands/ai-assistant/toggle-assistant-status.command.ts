import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CompanyAIAssistant } from '@core/entities/company-ai-assistant.entity';
import { AIAssistantResolverService } from '@core/services/ai-assistant-resolver.service';
import { AIAssistantService } from '@core/services/ai-assistant.service';
import { CompanyId } from '@core/value-objects/company-id.vo';
import { AIAssistantId } from '@core/value-objects/ai-assistant-id.vo';

export class ToggleAssistantStatusCommand {
  constructor(
    public readonly companyId: string | undefined,
    public readonly companyName: string | undefined,
    public readonly aiAssistantId: string | undefined,
    public readonly aiAssistantName: string | undefined,
    public readonly enabled: boolean,
  ) {}
}

@CommandHandler(ToggleAssistantStatusCommand)
export class ToggleAssistantStatusCommandHandler
  implements ICommandHandler<ToggleAssistantStatusCommand>
{
  constructor(
    private readonly aiAssistantService: AIAssistantService,
    private readonly resolverService: AIAssistantResolverService,
  ) {}

  async execute(command: ToggleAssistantStatusCommand): Promise<CompanyAIAssistant> {
    // Resolve company and AI assistant IDs
    const resolvedCompanyId = await this.resolverService.resolveCompanyId(
      command.companyId,
      command.companyName,
    );
    const resolvedAIAssistantId = await this.resolverService.resolveAIAssistantId(
      command.aiAssistantId,
      command.aiAssistantName,
    );

    // Convert to value objects
    const companyId = CompanyId.fromString(resolvedCompanyId);
    const assistantId = AIAssistantId.fromString(resolvedAIAssistantId);

    // Use AIAssistantService to toggle status
    return await this.aiAssistantService.toggleAssistantStatus(
      companyId,
      assistantId,
      command.enabled,
    );
  }
}
