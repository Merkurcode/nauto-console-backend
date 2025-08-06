import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
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
      throw new Error(`AI Assistant with id ${command.aiAssistantId} not found`);
    }

    // Check if assignment already exists
    const existingAssignment =
      await this.companyAIAssistantRepository.findByCompanyIdAndAssistantId(
        command.companyId,
        command.aiAssistantId,
      );

    if (existingAssignment) {
      //throw new Error(`AI Assistant is already assigned to this company`);
      return existingAssignment;
    }

    // Create assignment
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
}
