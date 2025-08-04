import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UserService } from '@core/services/user.service';
import { SessionService } from '@core/services/session.service';
import {
  AuthenticationException,
  BusinessRuleValidationException,
  EntityNotFoundException,
} from '@core/exceptions/domain-exceptions';
import { RolesEnum } from '@shared/constants/enums';
import { Inject } from '@nestjs/common';
import { USER_REPOSITORY } from '@shared/constants/tokens';
import { IUserRepository } from '@core/repositories/user.repository.interface';

export class ChangeEmailCommand {
  constructor(
    public readonly currentUserId: string,
    public readonly currentUserRoles: string[],
    public readonly currentUserCompanyId: string | null,
    public readonly newEmail: string,
    public readonly currentPassword: string,
    public readonly targetUserId: string | undefined,
    public readonly currentSessionToken: string,
  ) {}
}

@CommandHandler(ChangeEmailCommand)
export class ChangeEmailCommandHandler implements ICommandHandler<ChangeEmailCommand> {
  constructor(
    private readonly userService: UserService,
    private readonly sessionService: SessionService,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(command: ChangeEmailCommand): Promise<{
    message: string;
  }> {
    const {
      currentUserId,
      currentUserRoles,
      currentUserCompanyId,
      newEmail,
      currentPassword,
      targetUserId,
      currentSessionToken,
    } = command;

    // Determine the target user ID
    const actualTargetUserId = targetUserId || currentUserId;
    const isRoot = currentUserRoles.includes(RolesEnum.ROOT);
    const isAdmin = currentUserRoles.includes(RolesEnum.ADMIN);
    const isSelfOperation = actualTargetUserId === currentUserId;

    // Get target user to validate root restriction
    const targetUser = await this.userRepository.findById(actualTargetUserId);
    if (!targetUser) {
      throw new EntityNotFoundException('User', actualTargetUserId);
    }

    // Nobody can change a root user's email (including the root user themselves)
    if (targetUser.rolesCollection.containsByName(RolesEnum.ROOT)) {
      throw new BusinessRuleValidationException(
        "Root users' emails cannot be changed by any user, including themselves",
      );
    }

    // Authorization checks
    if (!isSelfOperation) {
      // Only root and admin can change other users' emails
      if (!isRoot && !isAdmin) {
        throw new BusinessRuleValidationException(
          "Only root and admin users can change other users' emails",
        );
      }

      // Admin can only change emails of users in their company
      if (isAdmin && !isRoot) {
        if (!currentUserCompanyId) {
          throw new BusinessRuleValidationException(
            "Admin user must belong to a company to change other users' emails",
          );
        }

        if (targetUser.companyId?.getValue() !== currentUserCompanyId) {
          throw new BusinessRuleValidationException(
            'Admin users can only change emails of users in their own company',
          );
        }
      }
    }

    // Password verification - always required for the target user
    const isCurrentPasswordValid = await this.userService.verifyCurrentPassword(
      actualTargetUserId,
      currentPassword,
    );

    if (!isCurrentPasswordValid) {
      throw new AuthenticationException('Target user password is incorrect');
    }

    // Update user email
    await this.userService.updateUserDetails(actualTargetUserId, undefined, undefined, newEmail);

    // Revoke sessions
    if (isSelfOperation) {
      // For self operations, revoke all other sessions except current
      await this.sessionService.revokeUserSessionsExcept(actualTargetUserId, currentSessionToken);

      return {
        message:
          'Email changed successfully. All other sessions have been logged out for security.',
      };
    } else {
      // For admin operations, revoke all sessions of the target user
      await this.sessionService.revokeUserSessions(actualTargetUserId, 'global');

      return {
        message:
          'User email changed successfully. All user sessions have been logged out for security.',
      };
    }
  }
}
