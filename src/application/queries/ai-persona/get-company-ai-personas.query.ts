import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { AIPersonaService } from '@core/services/ai-persona.service';
import { UserAuthorizationService } from '@core/services/user-authorization.service';
import { IAIPersonaResponse } from '@application/dtos/_responses/ai-persona/ai-persona.response.interface';
import { AIPersonaMapper } from '@application/mappers/ai-persona.mapper';

export class GetCompanyAIPersonasQuery {
  constructor(
    public readonly companyId: string,
    public readonly userId: string,
  ) {}
}

@Injectable()
@QueryHandler(GetCompanyAIPersonasQuery)
export class GetCompanyAIPersonasQueryHandler implements IQueryHandler<GetCompanyAIPersonasQuery> {
  constructor(
    private readonly aiPersonaService: AIPersonaService,
    private readonly userAuthorizationService: UserAuthorizationService,
  ) {}

  async execute(query: GetCompanyAIPersonasQuery): Promise<IAIPersonaResponse[]> {
    // Get current user
    const currentUser = await this.userAuthorizationService.getCurrentUserSafely(query.userId);

    const aiPersonas = await this.aiPersonaService.getCompanyAIPersonas(
      query.companyId,
      currentUser,
    );

    return aiPersonas.map(aiPersona => AIPersonaMapper.toResponse(aiPersona));
  }
}
