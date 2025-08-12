import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UserService } from '@core/services/user.service';
import { SessionService } from '@core/services/session.service';
import { AuthService } from '@core/services/auth.service';
import { IUserDetailResponse } from '@application/dtos/_responses/user/user.response';
import { UserMapper } from '@application/mappers/user.mapper';

export class AssignRoleCommand {
  constructor(
    public readonly userId: string,
    public readonly roleId: string,
    public readonly companyId?: string,
    public readonly assigningUserId?: string,
  ) {}
}

@CommandHandler(AssignRoleCommand)
export class AssignRoleCommandHandler
  implements ICommandHandler<AssignRoleCommand, IUserDetailResponse>
{
  constructor(
    private readonly userService: UserService,
    private readonly sessionService: SessionService,
    private readonly authService: AuthService,
  ) {}

  async execute(command: AssignRoleCommand): Promise<IUserDetailResponse> {
    const { userId, roleId, companyId, assigningUserId } = command;

    const user = await this.userService.assignRoleToUser(
      userId,
      roleId,
      companyId,
      assigningUserId,
    );

    // SECURITY: Force logout affected user for security
    // Global logout - revoke all sessions for the user
    await this.sessionService.revokeUserSessions(userId, 'global');
    // Also revoke all refresh tokens as a backup
    await this.authService.revokeAllRefreshTokens(userId);

    // Use the mapper to convert to response DTO
    return UserMapper.toDetailResponse(user);
  }
}
