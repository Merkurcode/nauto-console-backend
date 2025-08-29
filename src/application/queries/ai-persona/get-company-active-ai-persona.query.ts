import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { AIPersonaService } from '@core/services/ai-persona.service';
import { UserAuthorizationService } from '@core/services/user-authorization.service';
import { IAIPersonaResponse } from '@application/dtos/_responses/ai-persona/ai-persona.response.interface';
import { AIPersonaMapper } from '@application/mappers/ai-persona.mapper';

export class GetCompanyActiveAIPersonaQuery {
  constructor(
    public readonly companyId: string,
    public readonly userId: string | null,
  ) {}
}

@Injectable()
@QueryHandler(GetCompanyActiveAIPersonaQuery)
export class GetCompanyActiveAIPersonaQueryHandler
  implements IQueryHandler<GetCompanyActiveAIPersonaQuery>
{
  constructor(
    private readonly aiPersonaService: AIPersonaService,
    private readonly userAuthorizationService: UserAuthorizationService,
  ) {}

  async execute(query: GetCompanyActiveAIPersonaQuery): Promise<IAIPersonaResponse | null> {
    // Get current user if userId is provided
    const currentUser = query.userId
      ? await this.userAuthorizationService.getCurrentUserSafely(query.userId)
      : null;

    const aiPersona = await this.aiPersonaService.getCompanyActiveAIPersona(
      query.companyId,
      currentUser,
    );

    if (!aiPersona) {
      return null;
    }

    return AIPersonaMapper.toResponse(aiPersona);
  }
}
