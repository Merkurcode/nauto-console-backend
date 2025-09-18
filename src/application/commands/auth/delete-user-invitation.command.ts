import { ICommand, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable, Inject } from '@nestjs/common';
import { UserService } from '@core/services/user.service';
import { UserAuthorizationService } from '@core/services/user-authorization.service';
import {
  EntityNotFoundException,
  BusinessRuleValidationException,
  ForbiddenActionException,
} from '@core/exceptions/domain-exceptions';
import { IOtpRepository } from '@core/repositories/otp.repository.interface';
import { OTP_REPOSITORY } from '@shared/constants/tokens';

export class DeleteUserInvitationCommand implements ICommand {
  constructor(
    public readonly userId: string,
    public readonly currentUserId: string,
  ) {}
}

@Injectable()
@CommandHandler(DeleteUserInvitationCommand)
export class DeleteUserInvitationCommandHandler
  implements ICommandHandler<DeleteUserInvitationCommand>
{
  constructor(
    private readonly userService: UserService,
    private readonly userAuthorizationService: UserAuthorizationService,
    @Inject(OTP_REPOSITORY)
    private readonly otpRepository: IOtpRepository,
  ) {}

  async execute(command: DeleteUserInvitationCommand): Promise<{ message: string }> {
    const { userId, currentUserId } = command;

    // Get target user
    const targetUser = await this.userService.getUserById(userId);
    if (!targetUser) {
      throw new EntityNotFoundException('User', userId);
    }

    const currentUser = await this.userAuthorizationService.getCurrentUserSafely(currentUserId);
    if (
      !this.userAuthorizationService.canAccessCompany(currentUser, targetUser.companyId.getValue())
    ) {
      throw new ForbiddenActionException('You can only access your assigned company resources');
    }

    // Calculate invitation status to validate deletion
    const invitationStatus = targetUser.calculateInvitationStatus();

    // Only allow deletion of pending or expired invitations
    if (invitationStatus === 'completed') {
      throw new BusinessRuleValidationException(
        'Cannot delete invitation for a user who has already completed verification',
      );
    }

    //if (invitationStatus === 'error') {
    //  throw new BusinessRuleValidationException(
    //    'Cannot delete invitation with error status. Please resolve the error first or delete the user entirely',
    //  );
    //}

    // Delete user's OTP if exists
    const existingOtp = await this.otpRepository.findByUserId(userId);
    if (existingOtp) {
      await this.otpRepository.delete(existingOtp.id);
    }

    // Delete the user entirely (invitation deletion means user deletion for pending/expired cases)
    await this.userService.deleteUser(userId, currentUserId);

    return {
      message: `User invitation deleted successfully. User ${targetUser.email.getValue()} has been removed from the system.`,
    };
  }
}
