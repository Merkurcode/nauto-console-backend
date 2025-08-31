import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { AIPersonaService } from '@core/services/ai-persona.service';
import { IAIPersonaResponse } from '@application/dtos/_responses/ai-persona/ai-persona.response.interface';
import { AIPersonaMapper } from '@application/mappers/ai-persona.mapper';
import { UserAuthorizationService } from '@core/services/user-authorization.service';
import { RootLevelUserSpecification } from '@core/specifications/user.specifications';

export class GetAllAIPersonasQuery {
  constructor(
    public readonly filters?: {
      isActive?: boolean;
      isDefault?: boolean;
      companyId?: string;
      userCompanyId?: string;
    },
    public readonly userId?: string,
  ) {}
}

@Injectable()
@QueryHandler(GetAllAIPersonasQuery)
export class GetAllAIPersonasQueryHandler implements IQueryHandler<GetAllAIPersonasQuery> {
  constructor(
    private readonly aiPersonaService: AIPersonaService,
    private readonly userAuthorizationService: UserAuthorizationService,
  ) {}

  async execute(query: GetAllAIPersonasQuery): Promise<IAIPersonaResponse[]> {
    let filteredQuery = { ...query.filters };

    // Security validation: Apply company-based filtering unless user is ROOT
    if (query.userId) {
      const currentUser = await this.userAuthorizationService.getCurrentUserSafely(query.userId);
      const rootUserSpec = new RootLevelUserSpecification();
      const isRoot = rootUserSpec.isSatisfiedBy(currentUser);

      // If user is not ROOT, filter to only show personas they have access to
      if (!isRoot) {
        const userCompanyId = currentUser.companyId?.getValue();

        // If a specific companyId is requested in filters, validate access
        if (query.filters?.companyId !== undefined) {
          if (
            !this.userAuthorizationService.canAccessCompany(currentUser, query.filters.companyId)
          ) {
            // User cannot access this company, return empty array
            return [];
          }
        } else {
          // If no specific company requested, filter to user's company + defaults
          // This will be handled by the service layer
          filteredQuery = {
            ...filteredQuery,
            userCompanyId: userCompanyId,
          };
        }
      }
    }

    const aiPersonas = await this.aiPersonaService.getAllAIPersonas(filteredQuery);

    return aiPersonas.map(aiPersona => AIPersonaMapper.toResponse(aiPersona));
  }
}
