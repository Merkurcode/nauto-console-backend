import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { AIPersonaService } from '@core/services/ai-persona.service';
import { UserAuthorizationService } from '@core/services/user-authorization.service';
import { IAIPersonaResponse } from '@application/dtos/_responses/ai-persona/ai-persona.response.interface';
import { AIPersonaMapper } from '@application/mappers/ai-persona.mapper';

export class UpdateAIPersonaCommand {
  constructor(
    public readonly id: string,
    public readonly tone: string,
    public readonly personality: string,
    public readonly objective: string,
    public readonly shortDetails: string,
    public readonly language: string,
    public readonly updatedBy: string,
  ) {}
}

@Injectable()
@CommandHandler(UpdateAIPersonaCommand)
export class UpdateAIPersonaCommandHandler implements ICommandHandler<UpdateAIPersonaCommand> {
  constructor(
    private readonly aiPersonaService: AIPersonaService,
    private readonly userAuthorizationService: UserAuthorizationService,
  ) {}

  async execute(command: UpdateAIPersonaCommand): Promise<IAIPersonaResponse> {
    // Get current user
    const currentUser = await this.userAuthorizationService.getCurrentUserSafely(command.updatedBy);

    // Use service to update AI persona
    const updatedAIPersona = await this.aiPersonaService.updateAIPersona(
      command.id,
      command.tone,
      command.personality,
      command.objective,
      command.shortDetails,
      command.language,
      command.updatedBy,
      currentUser,
    );

    // Return response
    return AIPersonaMapper.toResponse(updatedAIPersona);
  }
}
