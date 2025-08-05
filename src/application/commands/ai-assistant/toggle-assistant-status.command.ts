import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { CompanyAIAssistant } from '@core/entities/company-ai-assistant.entity';
import { ICompanyAIAssistantRepository } from '@core/repositories/company-ai-assistant.repository.interface';
import { AIAssistantResolverService } from '@application/services/ai-assistant-resolver.service';
import { REPOSITORY_TOKENS } from '@shared/constants/tokens';

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
    @Inject(REPOSITORY_TOKENS.COMPANY_AI_ASSISTANT_REPOSITORY)
    private readonly companyAIAssistantRepository: ICompanyAIAssistantRepository,
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

    // Check if assignment exists
    const existingAssignment =
      await this.companyAIAssistantRepository.findByCompanyIdAndAssistantId(
        resolvedCompanyId,
        resolvedAIAssistantId,
      );

    if (existingAssignment) {
      // Update existing assignment
      return await this.companyAIAssistantRepository.toggleAssistantStatus(
        resolvedCompanyId,
        resolvedAIAssistantId,
        command.enabled,
      );
    }

    // Create new assignment with the desired enabled status
    const newAssignment = CompanyAIAssistant.create({
      id: crypto.randomUUID(),
      companyId: resolvedCompanyId,
      aiAssistantId: resolvedAIAssistantId,
      enabled: command.enabled,
      features: [],
    });

    return await this.companyAIAssistantRepository.create(newAssignment);
  }
}
