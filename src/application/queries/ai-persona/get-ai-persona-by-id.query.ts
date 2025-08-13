import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { AIPersonaService } from '@core/services/ai-persona.service';
import { IAIPersonaResponse } from '@application/dtos/_responses/ai-persona/ai-persona.response.interface';
import { AIPersonaMapper } from '@application/mappers/ai-persona.mapper';

export class GetAIPersonaByIdQuery {
  constructor(public readonly id: string) {}
}

@Injectable()
@QueryHandler(GetAIPersonaByIdQuery)
export class GetAIPersonaByIdQueryHandler implements IQueryHandler<GetAIPersonaByIdQuery> {
  constructor(private readonly aiPersonaService: AIPersonaService) {}

  async execute(query: GetAIPersonaByIdQuery): Promise<IAIPersonaResponse> {
    const aiPersona = await this.aiPersonaService.getAIPersonaById(query.id);

    return AIPersonaMapper.toResponse(aiPersona);
  }
}
