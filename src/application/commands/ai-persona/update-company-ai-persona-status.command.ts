import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { AIPersonaService } from '@core/services/ai-persona.service';
import { UserAuthorizationService } from '@core/services/user-authorization.service';
import { IAIPersonaAssignmentResponse } from '@application/dtos/_responses/ai-persona/ai-persona-assignment.response.interface';
import { AIPersonaMapper } from '@application/mappers/ai-persona.mapper';

export class UpdateCompanyAIPersonaStatusCommand {
  constructor(
    public readonly companyId: string,
    public readonly aiPersonaId: string,
    public readonly isActive: boolean,
    public readonly updatedBy: string,
  ) {}
}

@Injectable()
@CommandHandler(UpdateCompanyAIPersonaStatusCommand)
export class UpdateCompanyAIPersonaStatusCommandHandler
  implements ICommandHandler<UpdateCompanyAIPersonaStatusCommand>
{
  constructor(
    private readonly aiPersonaService: AIPersonaService,
    private readonly userAuthorizationService: UserAuthorizationService,
  ) {}

  async execute(
    command: UpdateCompanyAIPersonaStatusCommand,
  ): Promise<IAIPersonaAssignmentResponse> {
    // Get current user
    const currentUser = await this.userAuthorizationService.getCurrentUserSafely(command.updatedBy);

    // Use service to update the assignment status (all business logic is in the service)
    const updatedAssignment = await this.aiPersonaService.updateCompanyAIPersonaStatus(
      command.companyId,
      command.aiPersonaId,
      command.isActive,
      command.updatedBy,
      currentUser,
    );

    return AIPersonaMapper.toAssignmentResponse(updatedAssignment);
  }
}
