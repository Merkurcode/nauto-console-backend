import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Injectable } from '@nestjs/common';
import { UserService } from '@core/services/user.service';
import { SessionService } from '@core/services/session.service';
import { AuthService } from '@core/services/auth.service';
import { AuditLogService } from '@core/services/audit-log.service';
import { UserActivityLogService } from '@core/services/user-activity-log.service';
import { IUserDetailResponse } from '@application/dtos/_responses/user/user.response';
import { UserMapper } from '@application/mappers/user.mapper';
import { UserActivityImpact as UserActivityImpactEnum } from '@shared/constants/user-activity-impact.enum';
import { USER_REPOSITORY } from '@shared/constants/tokens';
import { IUserRepository } from '@core/repositories/user.repository.interface';
import {
  EntityNotFoundException,
  ForbiddenActionException,
} from '@core/exceptions/domain-exceptions';

export class BanUserCommand {
  constructor(
    public readonly targetUserId: string,
    public readonly banReason: string,
    public readonly currentUserId: string,
    public readonly bannedUntil?: Date, // Optional - if not provided, it's a permanent ban
    public readonly ipAddress?: string,
    public readonly userAgent?: string,
  ) {}
}

@Injectable()
@CommandHandler(BanUserCommand)
export class BanUserCommandHandler implements ICommandHandler<BanUserCommand, IUserDetailResponse> {
  constructor(
    private readonly userService: UserService,
    private readonly sessionService: SessionService,
    private readonly authService: AuthService,
    private readonly auditLogService: AuditLogService,
    private readonly userActivityLogService: UserActivityLogService,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(command: BanUserCommand): Promise<IUserDetailResponse> {
    const { targetUserId, banReason, bannedUntil, currentUserId, ipAddress, userAgent } = command;

    if (targetUserId === currentUserId) {
      throw new ForbiddenActionException('You cannot perform this operation on your own user');
    }

    // Get target user
    const targetUser = await this.userRepository.findById(targetUserId);
    if (!targetUser) {
      throw new EntityNotFoundException('User', targetUserId);
    }

    if (targetUser.isBanned()) {
      return UserMapper.toDetailResponse(targetUser);
    }

    // Ban the user using domain service with authorization
    const user = await this.userService.banUserWithAuthorization(
      targetUserId,
      banReason,
      bannedUntil,
      currentUserId,
    );

    // SECURITY: Force logout banned user immediately
    // Global logout - revoke all sessions for the user
    const terminatedSessionsCount = await this.sessionService.revokeUserSessions(
      targetUserId,
      'global',
    );
    // Also revoke all refresh tokens as a backup
    await this.authService.revokeAllRefreshTokens(targetUserId);

    // Log the ban action in audit log
    await this.auditLogService.logUserBan(currentUserId, targetUserId, {
      targetUserId,
      targetEmail: user.email.getValue(),
      banReason,
      bannedUntil: bannedUntil?.toISOString(),
      isPermanent: !bannedUntil,
      terminatedSessionsCount,
      action: 'user_ban',
      ipAddress,
      userAgent,
    });

    // Log in user activity log
    await this.userActivityLogService.logSecuritySettingsAsync(
      currentUserId,
      'ban_user',
      `Banned user ${user.email.getValue()} - Reason: ${banReason}`,
      UserActivityImpactEnum.HIGH,
      {
        ipAddress,
        userAgent,
        metadata: {
          targetUserId,
          targetEmail: user.email.getValue(),
          banReason,
          bannedUntil: bannedUntil?.toISOString(),
          isPermanent: !bannedUntil,
        },
      },
    );

    // Also log for the banned user
    await this.userActivityLogService.logSecuritySettingsAsync(
      targetUserId,
      'user_banned',
      `Account banned by administrator - Reason: ${banReason}`,
      UserActivityImpactEnum.HIGH,
      {
        ipAddress,
        userAgent,
        metadata: {
          bannedBy: currentUserId,
          banReason,
          bannedUntil: bannedUntil?.toISOString(),
          isPermanent: !bannedUntil,
        },
      },
    );

    return UserMapper.toDetailResponse(user);
  }
}
