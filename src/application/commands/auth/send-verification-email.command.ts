import { ICommand, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { SendVerificationEmailDto } from '@application/dtos/auth/email-verification.dto';
import { Injectable, Inject, ForbiddenException, ConflictException } from '@nestjs/common';
import { AuthService } from '@core/services/auth.service';
import { EmailService } from '@core/services/email.service';
import { SmsService } from '@core/services/sms.service';
import { UserService } from '@core/services/user.service';
import { UserAuthorizationService } from '@core/services/user-authorization.service';
import { InvalidCredentialsException } from '@core/exceptions/domain-exceptions';
import { User } from '@core/entities/user.entity';
import { ILogger } from '@core/interfaces/logger.interface';
import { LOGGER_SERVICE } from '@shared/constants/tokens';

export class SendVerificationEmailCommand implements ICommand {
  constructor(
    public readonly dto: SendVerificationEmailDto,
    public readonly currentUserId: string,
    public readonly currentUserRoles: string[],
    public readonly currentUserCompanyId: string | null,
  ) {}
}

@Injectable()
@CommandHandler(SendVerificationEmailCommand)
export class SendVerificationEmailCommandHandler
  implements ICommandHandler<SendVerificationEmailCommand, { message: string }>
{
  constructor(
    private readonly authService: AuthService,
    private readonly emailService: EmailService,
    private readonly smsService: SmsService,
    private readonly userService: UserService,
    private readonly userAuthorizationService: UserAuthorizationService,
    @Inject(LOGGER_SERVICE) private readonly logger: ILogger,
  ) {
    this.logger.setContext(SendVerificationEmailCommandHandler.name);
  }

  async execute(command: SendVerificationEmailCommand): Promise<{ message: string }> {
    const { email, phoneNumber } = command.dto;
    const { currentUserId, currentUserCompanyId } = command;

    // Get current user using centralized method
    const currentUser = await this.userAuthorizationService.getCurrentUserSafely(currentUserId);

    // SECURITY: Validate access permissions
    await this.validateAccess(email, currentUser, currentUserCompanyId);

    // SECURITY: Verify that the email is registered in the system
    const targetUser = await this.userService.findUserByEmailForVerification(email);
    if (!targetUser) {
      // SECURITY: Use generic message to prevent email enumeration
      throw new InvalidCredentialsException();
    }

    // SECURITY: Check if email is already verified
    if (targetUser.emailVerified) {
      throw new ConflictException('Email is already verified');
    }

    // Generate a verification code
    const code = await this.authService.generateEmailVerificationCode(email);

    // Send the verification email
    const emailSent = await this.emailService.sendVerificationEmail(email, code);

    // Send SMS if phone number is provided (and user has phone number)
    let smsSent = false;
    if (phoneNumber && targetUser.profile?.phone) {
      this.logger.debug(
        `SMS verification requested - phoneNumberProvided: ${!!phoneNumber}, userHasPhone: ${!!targetUser.profile?.phone}, userId: ${targetUser.id.getValue()}`,
      );

      // Verify the provided phone number matches the user's registered phone
      if (targetUser.profile.phone === phoneNumber) {
        this.logger.debug('Phone numbers match, sending SMS verification');
        // Get user's country code from profile or default to Mexico
        const countryCode = targetUser.profile.phoneCountryCode;

        smsSent = await this.smsService.sendVerificationSms(phoneNumber, code, countryCode);
        this.logger.debug(`SMS verification result - sent: ${smsSent}`);
      } else {
        this.logger.debug('Phone numbers do not match - SMS not sent');
      }
    } else {
      this.logger.debug(
        `SMS verification skipped - phoneNumberProvided: ${!!phoneNumber}, userHasPhone: ${!!targetUser.profile?.phone}`,
      );
    }

    // Build response message
    let message = '';
    if (emailSent && smsSent) {
      message = 'Verification code sent via email and SMS successfully';
    } else if (emailSent && phoneNumber && !smsSent) {
      message = 'Verification email sent successfully, but SMS failed to send';
    } else if (emailSent) {
      message = 'Verification email sent successfully';
    } else {
      message = 'Failed to send verification code';
    }

    return { message };
  }

  private async validateAccess(
    email: string,
    currentUser: User,
    currentUserCompanyId: string | null,
  ): Promise<void> {
    // Use centralized authorization service for email verification permission
    const canSend = this.userAuthorizationService.canSendEmailVerification(
      currentUser,
      email,
      currentUserCompanyId,
    );

    if (!canSend) {
      throw new ForbiddenException(
        'You do not have permission to send verification emails to this email address',
      );
    }
  }
}
