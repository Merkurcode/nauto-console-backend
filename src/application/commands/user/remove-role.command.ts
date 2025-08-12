import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { UserService } from '@core/services/user.service';
import { SessionService } from '@core/services/session.service';
import { AuthService } from '@core/services/auth.service';
import { IUserDetailResponse } from '@application/dtos/_responses/user/user.response';
import { UserMapper } from '@application/mappers/user.mapper';

export class RemoveRoleCommand {
  constructor(
    public readonly targetUserId: string,
    public readonly roleId: string,
    public readonly currentUserId: string,
    public readonly companyId: string,
  ) {}
}

@Injectable()
@CommandHandler(RemoveRoleCommand)
export class RemoveRoleCommandHandler
  implements ICommandHandler<RemoveRoleCommand, IUserDetailResponse>
{
  constructor(
    private readonly userService: UserService,
    private readonly sessionService: SessionService,
    private readonly authService: AuthService,
  ) {}

  async execute(command: RemoveRoleCommand): Promise<IUserDetailResponse> {
    const { targetUserId, roleId, currentUserId } = command;

    // Use domain service with authorization
    const user = await this.userService.removeRoleFromUserWithAuthorization(
      targetUserId,
      roleId,
      currentUserId,
    );

    // SECURITY: Force logout affected user for security
    // Global logout - revoke all sessions for the user
    await this.sessionService.revokeUserSessions(targetUserId, 'global');
    // Also revoke all refresh tokens as a backup
    await this.authService.revokeAllRefreshTokens(targetUserId);

    // Use the mapper to convert to response DTO
    return UserMapper.toDetailResponse(user);
  }
}
