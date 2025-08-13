import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { AIPersonaService } from '@core/services/ai-persona.service';
import { UserAuthorizationService } from '@core/services/user-authorization.service';
import { ICompanyAIPersonaAssignment } from '@core/repositories/company-ai-persona.repository.interface';

export class AssignAIPersonaToCompanyCommand {
  constructor(
    public readonly companyId: string,
    public readonly aiPersonaId: string,
    public readonly assignedBy: string,
  ) {}
}

@Injectable()
@CommandHandler(AssignAIPersonaToCompanyCommand)
export class AssignAIPersonaToCompanyCommandHandler
  implements ICommandHandler<AssignAIPersonaToCompanyCommand>
{
  constructor(
    private readonly aiPersonaService: AIPersonaService,
    private readonly userAuthorizationService: UserAuthorizationService,
  ) {}

  async execute(command: AssignAIPersonaToCompanyCommand): Promise<ICompanyAIPersonaAssignment> {
    // Get current user
    const currentUser = await this.userAuthorizationService.getCurrentUserSafely(
      command.assignedBy,
    );

    // Use service to assign AI persona to company
    return await this.aiPersonaService.assignAIPersonaToCompany(
      command.companyId,
      command.aiPersonaId,
      command.assignedBy,
      currentUser,
    );
  }
}
