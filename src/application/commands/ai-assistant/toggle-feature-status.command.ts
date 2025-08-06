import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { ICompanyAIAssistantRepository } from '@core/repositories/company-ai-assistant.repository.interface';
import { REPOSITORY_TOKENS } from '@shared/constants/tokens';

export class ToggleFeatureStatusCommand {
  constructor(
    public readonly assignmentId: string,
    public readonly featureId: string,
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
  ) {}

  async execute(command: ToggleFeatureStatusCommand): Promise<void> {
    await this.companyAIAssistantRepository.toggleFeatureStatus(
      command.assignmentId,
      command.featureId,
      command.enabled,
    );
  }
}
