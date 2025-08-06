import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { AIAssistantMapper } from '@application/mappers/ai-assistant.mapper';
import { IAIAssistantRepository } from '@core/repositories/ai-assistant.repository.interface';
import { IAIAssistantResponse } from '@application/dtos/responses/ai-assistant.response';
import { REPOSITORY_TOKENS } from '@shared/constants/tokens';

export class GetAvailableAssistantsQuery {
  constructor(public readonly lang: string = 'en-US') {}
}

@QueryHandler(GetAvailableAssistantsQuery)
export class GetAvailableAssistantsQueryHandler
  implements IQueryHandler<GetAvailableAssistantsQuery>
{
  constructor(
    @Inject(REPOSITORY_TOKENS.AI_ASSISTANT_REPOSITORY)
    private readonly aiAssistantRepository: IAIAssistantRepository,
    private readonly aiAssistantMapper: AIAssistantMapper,
  ) {}

  async execute(query: GetAvailableAssistantsQuery): Promise<IAIAssistantResponse[]> {
    const assistants = await this.aiAssistantRepository.findAllAvailable();

    return this.aiAssistantMapper.toResponseList(assistants, query.lang);
  }
}
