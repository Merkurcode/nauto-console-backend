import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { AIAssistantMapper } from '@application/mappers/ai-assistant.mapper';
import { AIAssistantResolverService } from '@core/services/ai-assistant-resolver.service';
import { AIAssistantService } from '@core/services/ai-assistant.service';
import { ICompanyAIAssistantResponse } from '@application/dtos/_responses/ai-assistant/ai-assistant.response';
import { CompanyId } from '@core/value-objects/company-id.vo';
import { IJwtPayload } from '@application/dtos/_responses/user/user.response';
import { ForbiddenActionException } from '@core/exceptions/domain-exceptions';
import { UserAuthorizationService } from '@core/services/user-authorization.service';

export class GetCompanyAssistantsQuery {
  constructor(
    public readonly companyIdentifier: string,
    public readonly lang: string = 'en-US',
    public readonly currentUser?: IJwtPayload,
  ) {}
}

@QueryHandler(GetCompanyAssistantsQuery)
export class GetCompanyAssistantsQueryHandler implements IQueryHandler<GetCompanyAssistantsQuery> {
  constructor(
    private readonly aiAssistantService: AIAssistantService,
    private readonly aiAssistantMapper: AIAssistantMapper,
    private readonly resolverService: AIAssistantResolverService,
    private readonly userAuthorizationService: UserAuthorizationService,
  ) {}

  async execute(query: GetCompanyAssistantsQuery): Promise<ICompanyAIAssistantResponse[]> {
    // Determine if the identifier is a UUID (companyId) or a name (companyName)
    const isUUID = this.isValidUUID(query.companyIdentifier);
    const resolvedCompanyId = isUUID
      ? await this.resolverService.resolveCompanyId(query.companyIdentifier, undefined)
      : await this.resolverService.resolveCompanyId(undefined, query.companyIdentifier);

    // Security validation: Users can only access their own company unless they are ROOT
    if (query.currentUser && query.currentUser.sub) {
      // Get current user to validate permissions
      const currentUser = await this.userAuthorizationService.getCurrentUserSafely(
        query.currentUser.sub,
      );

      // Check if user can access this company's data
      if (!this.userAuthorizationService.canAccessCompany(currentUser, resolvedCompanyId)) {
        throw new ForbiddenActionException(
          'You can only access AI assistants for your own company',
        );
      }
    }

    // Convert to value object
    const companyId = CompanyId.fromString(resolvedCompanyId);

    // Get assignments and available assistants using AIAssistantService
    const assignments = await this.aiAssistantService.getCompanyAssistants(companyId);

    if (assignments.length === 0) {
      return [];
    }

    const assistantIds = assignments.map(assignment => assignment.aiAssistantId);
    const assistants = await this.aiAssistantService.getAvailableAssistants();
    const relevantAssistants = assistants.filter(assistant => assistantIds.includes(assistant.id));

    return this.aiAssistantMapper.toCompanyAssistantResponseList(
      assignments,
      relevantAssistants,
      query.lang,
    );
  }

  private isValidUUID(str: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    return uuidRegex.test(str);
  }
}
