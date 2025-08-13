import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { AIPersonaService } from '@core/services/ai-persona.service';
import { UserAuthorizationService } from '@core/services/user-authorization.service';
import { IAIPersonaResponse } from '@application/dtos/_responses/ai-persona/ai-persona.response.interface';
import { AIPersonaMapper } from '@application/mappers/ai-persona.mapper';

export class UpdateAIPersonaStatusCommand {
  constructor(
    public readonly id: string,
    public readonly isActive: boolean,
    public readonly updatedBy: string,
  ) {}
}

@Injectable()
@CommandHandler(UpdateAIPersonaStatusCommand)
export class UpdateAIPersonaStatusCommandHandler
  implements ICommandHandler<UpdateAIPersonaStatusCommand>
{
  constructor(
    private readonly aiPersonaService: AIPersonaService,
    private readonly userAuthorizationService: UserAuthorizationService,
  ) {}

  async execute(command: UpdateAIPersonaStatusCommand): Promise<IAIPersonaResponse> {
    // Get current user
    const currentUser = await this.userAuthorizationService.getCurrentUserSafely(command.updatedBy);

    // Update AI persona status
    const updatedAIPersona = await this.aiPersonaService.updateAIPersonaStatus(
      command.id,
      command.isActive,
      command.updatedBy,
      currentUser,
    );

    return AIPersonaMapper.toResponse(updatedAIPersona);
  }
}
