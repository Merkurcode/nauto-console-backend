import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { UserService } from '@core/services/user.service';
import { SessionService } from '@core/services/session.service';
import { AuthService } from '@core/services/auth.service';
import { IUserBaseResponse } from '@application/dtos/_responses/user/user.response';

export class ActivateUserCommand {
  constructor(
    public readonly targetUserId: string,
    public readonly active: boolean,
    public readonly currentUserId: string,
    public readonly companyId: string,
  ) {}
}

@Injectable()
@CommandHandler(ActivateUserCommand)
export class ActivateUserCommandHandler
  implements ICommandHandler<ActivateUserCommand, IUserBaseResponse>
{
  constructor(
    private readonly userService: UserService,
    private readonly sessionService: SessionService,
    private readonly authService: AuthService,
  ) {}

  async execute(command: ActivateUserCommand): Promise<IUserBaseResponse> {
    const { targetUserId, active, currentUserId } = command;

    // Use domain service with authorization
    const user = await this.userService.activateUserWithAuthorization(
      targetUserId,
      active,
      currentUserId,
    );

    // SECURITY: Force logout affected user for security
    // Global logout - revoke all sessions for the user
    await this.sessionService.revokeUserSessions(targetUserId, 'global');
    // Also revoke all refresh tokens as a backup
    await this.authService.revokeAllRefreshTokens(targetUserId);

    return {
      id: user.id.getValue(),
      email: user.email.getValue(),
      firstName: user.firstName.getValue(),
      lastName: user.lastName.getValue(),
    };
  }
}
