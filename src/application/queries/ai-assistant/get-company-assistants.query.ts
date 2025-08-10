import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { AIAssistantMapper } from '@application/mappers/ai-assistant.mapper';
import { AIAssistantResolverService } from '@core/services/ai-assistant-resolver.service';
import { IAIAssistantRepository } from '@core/repositories/ai-assistant.repository.interface';
import { ICompanyAIAssistantRepository } from '@core/repositories/company-ai-assistant.repository.interface';
import { ICompanyAIAssistantResponse } from '@application/dtos/responses/ai-assistant.response';
import { REPOSITORY_TOKENS } from '@shared/constants/tokens';

export class GetCompanyAssistantsQuery {
  constructor(
    public readonly companyIdentifier: string,
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
    private readonly resolverService: AIAssistantResolverService,
  ) {}

  async execute(query: GetCompanyAssistantsQuery): Promise<ICompanyAIAssistantResponse[]> {
    // Determine if the identifier is a UUID (companyId) or a name (companyName)
    const isUUID = this.isValidUUID(query.companyIdentifier);
    const companyId = isUUID
      ? await this.resolverService.resolveCompanyId(query.companyIdentifier, undefined)
      : await this.resolverService.resolveCompanyId(undefined, query.companyIdentifier);

    const assignments = await this.companyAIAssistantRepository.findByCompanyId(companyId);

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

  private isValidUUID(str: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    return uuidRegex.test(str);
  }
}
