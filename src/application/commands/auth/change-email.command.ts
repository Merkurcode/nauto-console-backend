import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UserService } from '@core/services/user.service';
import { SessionService } from '@core/services/session.service';
import { UserAuthorizationService } from '@core/services/user-authorization.service';
import {
  AuthenticationException,
  BusinessRuleValidationException,
  EntityNotFoundException,
} from '@core/exceptions/domain-exceptions';

export class ChangeEmailCommand {
  constructor(
    public readonly currentUserId: string,
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
    private readonly userAuthorizationService: UserAuthorizationService,
  ) {}

  async execute(command: ChangeEmailCommand): Promise<{
    message: string;
  }> {
    const { currentUserId, newEmail, currentPassword, targetUserId, currentSessionToken } = command;

    // Get current user using centralized method
    const currentUser = await this.userAuthorizationService.getCurrentUserSafely(currentUserId);

    // Determine the target user ID
    const actualTargetUserId = targetUserId || currentUserId;
    const isSelfOperation = actualTargetUserId === currentUserId;

    // Get target user to validate root restriction
    const targetUser = await this.userService.getUserById(actualTargetUserId);
    if (!targetUser) {
      throw new EntityNotFoundException('User', actualTargetUserId);
    }

    // Use centralized authorization service for email change validation
    try {
      this.userAuthorizationService.canChangeUserEmail(
        currentUser,
        actualTargetUserId,
        targetUser.companyId?.getValue(),
      );
    } catch (error) {
      // Convert domain exception to business rule validation exception
      throw new BusinessRuleValidationException(error.message);
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
