import { ICommand, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { AuthService } from '@core/services/auth.service';
import { SessionService } from '@core/services/session.service';
import { UserId } from '@core/value-objects/user-id.vo';
import { CompanyId } from '@core/value-objects/company-id.vo';
import { CompanyService } from '@core/services/company.service';

export class AssignUserToCompanyCommand implements ICommand {
  constructor(
    public readonly userId: UserId,
    public readonly companyId: CompanyId,
    public readonly currentUserId: UserId,
  ) {}
}

@Injectable()
@CommandHandler(AssignUserToCompanyCommand)
export class AssignUserToCompanyCommandHandler
  implements ICommandHandler<AssignUserToCompanyCommand>
{
  constructor(
    private readonly authService: AuthService,
    private readonly sessionService: SessionService,
    private readonly companyService: CompanyService,
  ) {}

  async execute(command: AssignUserToCompanyCommand): Promise<void> {
    const { userId, companyId, currentUserId } = command;

    // Use domain service to assign user to company
    await this.companyService.assignUserToCompany(userId, companyId, currentUserId);

    // Global logout - revoke all sessions for the user
    await this.sessionService.revokeUserSessions(command.userId.getValue(), 'global');
    // Also revoke all refresh tokens as a backup
    await this.authService.revokeAllRefreshTokens(command.userId.getValue());
  }
}
