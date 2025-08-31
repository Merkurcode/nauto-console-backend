import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { AIPersonaService } from '@core/services/ai-persona.service';
import { IAIPersonaResponse } from '@application/dtos/_responses/ai-persona/ai-persona.response.interface';
import { AIPersonaMapper } from '@application/mappers/ai-persona.mapper';
import { UserAuthorizationService } from '@core/services/user-authorization.service';
import { RootLevelUserSpecification } from '@core/specifications/user.specifications';
import { EntityNotFoundException } from '@core/exceptions/domain-exceptions';

export class GetAIPersonaByIdQuery {
  constructor(
    public readonly id: string,
    public readonly userId?: string,
  ) {}
}

@Injectable()
@QueryHandler(GetAIPersonaByIdQuery)
export class GetAIPersonaByIdQueryHandler implements IQueryHandler<GetAIPersonaByIdQuery> {
  constructor(
    private readonly aiPersonaService: AIPersonaService,
    private readonly userAuthorizationService: UserAuthorizationService,
  ) {}

  async execute(query: GetAIPersonaByIdQuery): Promise<IAIPersonaResponse> {
    const aiPersona = await this.aiPersonaService.getAIPersonaById(query.id);

    // Security validation: Check if user can access this AI Persona
    if (query.userId) {
      const currentUser = await this.userAuthorizationService.getCurrentUserSafely(query.userId);
      const rootUserSpec = new RootLevelUserSpecification();
      const isRoot = rootUserSpec.isSatisfiedBy(currentUser);

      // If user is not ROOT, apply access control
      if (!isRoot) {
        const personaCompanyId = aiPersona.companyId;
        const userCompanyId = currentUser.companyId?.getValue();

        // Access rules for non-ROOT users:
        // 1. Can access if persona has no company (companyId is null - default personas)
        // 2. Can access if persona belongs to user's company
        const canAccess =
          personaCompanyId === null || // Default personas (companyId is null)
          (userCompanyId && personaCompanyId === userCompanyId); // User's company personas

        if (!canAccess) {
          throw new EntityNotFoundException('AI Persona', query.id);
        }
      }
    }

    return AIPersonaMapper.toResponse(aiPersona);
  }
}
