import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { AIAssistantMapper } from '@application/mappers/ai-assistant.mapper';
import { AIAssistantService } from '@core/services/ai-assistant.service';
import { IAIAssistantResponse } from '@application/dtos/_responses/ai-assistant/ai-assistant.response';

export class GetAvailableAssistantsQuery {
  constructor(public readonly lang: string = 'en-US') {}
}

@QueryHandler(GetAvailableAssistantsQuery)
export class GetAvailableAssistantsQueryHandler
  implements IQueryHandler<GetAvailableAssistantsQuery>
{
  constructor(
    private readonly aiAssistantService: AIAssistantService,
    private readonly aiAssistantMapper: AIAssistantMapper,
  ) {}

  async execute(query: GetAvailableAssistantsQuery): Promise<IAIAssistantResponse[]> {
    const assistants = await this.aiAssistantService.getAvailableAssistants();

    return this.aiAssistantMapper.toResponseList(assistants, query.lang);
  }
}
