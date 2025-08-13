import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { AIPersonaService } from '@core/services/ai-persona.service';
import { IAIPersonaResponse } from '@application/dtos/_responses/ai-persona/ai-persona.response.interface';
import { AIPersonaMapper } from '@application/mappers/ai-persona.mapper';

export class GetAllAIPersonasQuery {
  constructor(
    public readonly filters?: {
      isActive?: boolean;
      isDefault?: boolean;
      companyId?: string;
    },
    public readonly userId?: string,
  ) {}
}

@Injectable()
@QueryHandler(GetAllAIPersonasQuery)
export class GetAllAIPersonasQueryHandler implements IQueryHandler<GetAllAIPersonasQuery> {
  constructor(private readonly aiPersonaService: AIPersonaService) {}

  async execute(query: GetAllAIPersonasQuery): Promise<IAIPersonaResponse[]> {
    const aiPersonas = await this.aiPersonaService.getAllAIPersonas(query.filters);

    return aiPersonas.map(aiPersona => AIPersonaMapper.toResponse(aiPersona));
  }
}
