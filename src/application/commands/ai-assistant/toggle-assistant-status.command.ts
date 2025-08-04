import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { CompanyAIAssistant } from '@core/entities/company-ai-assistant.entity';
import { ICompanyAIAssistantRepository } from '@core/repositories/company-ai-assistant.repository.interface';
import { REPOSITORY_TOKENS } from '@shared/constants/tokens';

export class ToggleAssistantStatusCommand {
  constructor(
    public readonly companyId: string,
    public readonly aiAssistantId: string,
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
  ) {}

  async execute(command: ToggleAssistantStatusCommand): Promise<CompanyAIAssistant> {
    // Verify assignment exists
    const assignment = await this.companyAIAssistantRepository.findByCompanyIdAndAssistantId(
      command.companyId,
      command.aiAssistantId,
    );

    if (!assignment) {
      throw new Error(`AI Assistant assignment not found for company`);
    }

    return await this.companyAIAssistantRepository.toggleAssistantStatus(
      command.companyId,
      command.aiAssistantId,
      command.enabled,
    );
  }
}
