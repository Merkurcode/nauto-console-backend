import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { AIPersonaService } from '@core/services/ai-persona.service';
import { UserAuthorizationService } from '@core/services/user-authorization.service';
import { IAIPersonaResponse } from '@application/dtos/_responses/ai-persona/ai-persona.response.interface';
import { AIPersonaMapper } from '@application/mappers/ai-persona.mapper';

export class CreateAIPersonaCommand {
  constructor(
    public readonly name: string,
    public readonly tone: string,
    public readonly personality: string,
    public readonly objective: string,
    public readonly shortDetails: string,
    public readonly language: string,
    public readonly isDefault: boolean,
    public readonly companyId: string | null,
    public readonly createdBy: string,
  ) {}
}

@Injectable()
@CommandHandler(CreateAIPersonaCommand)
export class CreateAIPersonaCommandHandler implements ICommandHandler<CreateAIPersonaCommand> {
  constructor(
    private readonly aiPersonaService: AIPersonaService,
    private readonly userAuthorizationService: UserAuthorizationService,
  ) {}

  async execute(command: CreateAIPersonaCommand): Promise<IAIPersonaResponse> {
    // Get current user
    const currentUser = await this.userAuthorizationService.getCurrentUserSafely(command.createdBy);

    // Use service to create AI persona
    const aiPersona = await this.aiPersonaService.createAIPersona(
      command.name,
      command.tone,
      command.personality,
      command.objective,
      command.shortDetails,
      command.language,
      command.isDefault,
      command.companyId,
      command.createdBy,
      currentUser,
    );

    // Return response
    return AIPersonaMapper.toResponse(aiPersona);
  }
}
