import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { AIPersonaService } from '@core/services/ai-persona.service';
import { UserAuthorizationService } from '@core/services/user-authorization.service';
import { IAIPersonaDeleteResponse } from '@application/dtos/_responses/ai-persona/ai-persona-delete.response.interface';

export class DeleteAIPersonaCommand {
  constructor(
    public readonly id: string,
    public readonly deletedBy: string,
  ) {}
}

@Injectable()
@CommandHandler(DeleteAIPersonaCommand)
export class DeleteAIPersonaCommandHandler implements ICommandHandler<DeleteAIPersonaCommand> {
  constructor(
    private readonly aiPersonaService: AIPersonaService,
    private readonly userAuthorizationService: UserAuthorizationService,
  ) {}

  async execute(command: DeleteAIPersonaCommand): Promise<IAIPersonaDeleteResponse> {
    // Get current user
    const currentUser = await this.userAuthorizationService.getCurrentUserSafely(command.deletedBy);

    // Use service to delete AI persona
    const deleted = await this.aiPersonaService.deleteAIPersona(command.id, currentUser);

    if (!deleted) {
      throw new Error('Failed to delete AI persona');
    }

    return {
      id: command.id,
      message: 'AI persona deleted successfully',
      deletedAt: new Date(),
    };
  }
}
