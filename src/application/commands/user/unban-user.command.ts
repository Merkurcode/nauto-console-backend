import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Injectable } from '@nestjs/common';
import { UserService } from '@core/services/user.service';
import { CompanyService } from '@core/services/company.service';
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
  BusinessRuleValidationException,
} from '@core/exceptions/domain-exceptions';

export class UnbanUserCommand {
  constructor(
    public readonly targetUserId: string,
    public readonly currentUserId: string,
    public readonly ipAddress?: string,
    public readonly userAgent?: string,
  ) {}
}

@Injectable()
@CommandHandler(UnbanUserCommand)
export class UnbanUserCommandHandler
  implements ICommandHandler<UnbanUserCommand, IUserDetailResponse>
{
  constructor(
    private readonly userService: UserService,
    private readonly companyService: CompanyService,
    private readonly auditLogService: AuditLogService,
    private readonly userActivityLogService: UserActivityLogService,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(command: UnbanUserCommand): Promise<IUserDetailResponse> {
    const { targetUserId, currentUserId, ipAddress, userAgent } = command;

    if (targetUserId === currentUserId) {
      throw new ForbiddenActionException('You cannot perform this operation on your own user');
    }

    // Get target user
    const targetUser = await this.userRepository.findById(targetUserId);
    if (!targetUser) {
      throw new EntityNotFoundException('User', targetUserId);
    }

    if (!targetUser.isBanned()) {
      return UserMapper.toDetailResponse(targetUser);
    }

    // Check if user's company is active (if they have one)
    if (targetUser.companyId) {
      const company = await this.companyService.getCompanyById(targetUser.companyId);

      if (!company || !company.isActive) {
        throw new BusinessRuleValidationException(
          'Cannot unban user from an inactive company. The company must be reactivated first.',
        );
      }
    }

    // Unban the user using domain service with authorization
    const user = await this.userService.unbanUserWithAuthorization(targetUserId, currentUserId);

    // Log the unban action in audit log
    await this.auditLogService.logUserUnban(currentUserId, targetUserId, {
      targetUserId,
      targetEmail: user.email.getValue(),
      action: 'user_unban',
      ipAddress,
      userAgent,
    });

    // Log in user activity log
    await this.userActivityLogService.logSecuritySettingsAsync(
      currentUserId,
      'unban_user',
      `Unbanned user ${user.email.getValue()}`,
      UserActivityImpactEnum.HIGH,
      {
        ipAddress,
        userAgent,
        metadata: {
          targetUserId,
          targetEmail: user.email.getValue(),
        },
      },
    );

    // Also log for the unbanned user
    await this.userActivityLogService.logSecuritySettingsAsync(
      targetUserId,
      'user_unbanned',
      `Account unbanned by administrator`,
      UserActivityImpactEnum.HIGH,
      {
        ipAddress,
        userAgent,
        metadata: {
          unbannedBy: currentUserId,
        },
      },
    );

    return UserMapper.toDetailResponse(user);
  }
}
