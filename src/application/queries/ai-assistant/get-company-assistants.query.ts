import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { AIAssistantMapper } from '@application/mappers/ai-assistant.mapper';
import { IAIAssistantRepository } from '@core/repositories/ai-assistant.repository.interface';
import { ICompanyAIAssistantRepository } from '@core/repositories/company-ai-assistant.repository.interface';
import { ICompanyAIAssistantResponse } from '@application/dtos/responses/ai-assistant.response';
import { REPOSITORY_TOKENS } from '@shared/constants/tokens';

export class GetCompanyAssistantsQuery {
  constructor(
    public readonly companyId: string,
    public readonly lang: string = 'en-US',
  ) {}
}

@QueryHandler(GetCompanyAssistantsQuery)
export class GetCompanyAssistantsQueryHandler implements IQueryHandler<GetCompanyAssistantsQuery> {
  constructor(
    @Inject(REPOSITORY_TOKENS.AI_ASSISTANT_REPOSITORY)
    private readonly aiAssistantRepository: IAIAssistantRepository,
    @Inject(REPOSITORY_TOKENS.COMPANY_AI_ASSISTANT_REPOSITORY)
    private readonly companyAIAssistantRepository: ICompanyAIAssistantRepository,
    private readonly aiAssistantMapper: AIAssistantMapper,
  ) {}

  async execute(query: GetCompanyAssistantsQuery): Promise<ICompanyAIAssistantResponse[]> {
    const assignments = await this.companyAIAssistantRepository.findByCompanyId(query.companyId);

    if (assignments.length === 0) {
      return [];
    }

    const assistantIds = assignments.map(assignment => assignment.aiAssistantId);
    const assistants = await this.aiAssistantRepository.findByIds(assistantIds);

    return this.aiAssistantMapper.toCompanyAssistantResponseList(
      assignments,
      assistants,
      query.lang,
    );
  }
}
