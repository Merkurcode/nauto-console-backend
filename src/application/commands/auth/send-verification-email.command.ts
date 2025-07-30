import { ICommand, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { SendVerificationEmailDto } from '@application/dtos/auth/email-verification.dto';
import { Injectable, Inject, Logger } from '@nestjs/common';
import { AuthService } from '@core/services/auth.service';
import { EmailService } from '@core/services/email.service';
import { SmsService } from '@core/services/sms.service';
import { IUserRepository } from '@core/repositories/user.repository.interface';
import { USER_REPOSITORY } from '@shared/constants/tokens';
import { EntityNotFoundException } from '@core/exceptions/domain-exceptions';
import { Email } from '@core/value-objects/email.vo';

export class SendVerificationEmailCommand implements ICommand {
  constructor(public readonly dto: SendVerificationEmailDto) {}
}

@Injectable()
@CommandHandler(SendVerificationEmailCommand)
export class SendVerificationEmailCommandHandler
  implements ICommandHandler<SendVerificationEmailCommand, { message: string }>
{
  private readonly logger = new Logger(SendVerificationEmailCommandHandler.name);

  constructor(
    private readonly authService: AuthService,
    private readonly emailService: EmailService,
    private readonly smsService: SmsService,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(command: SendVerificationEmailCommand): Promise<{ message: string }> {
    const { email, phoneNumber } = command.dto;

    // Validate email format using value object
    const _emailVO = new Email(email);

    // SECURITY: Verify that the email is registered in the system
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new EntityNotFoundException('User with this email is not registered', email);
    }

    // Generate a verification code
    const code = await this.authService.generateEmailVerificationCode(email);

    // Send the verification email
    const emailSent = await this.emailService.sendVerificationEmail(email, code);

    // Send SMS if phone number is provided (and user has phone number)
    let smsSent = false;
    if (phoneNumber && user.profile?.phone) {
      this.logger.debug('SMS verification requested', {
        phoneNumberProvided: !!phoneNumber,
        userHasPhone: !!user.profile?.phone,
        userId: user.id.getValue(),
      });

      // Verify the provided phone number matches the user's registered phone
      if (user.profile.phone === phoneNumber) {
        this.logger.debug('Phone numbers match, sending SMS verification');
        smsSent = await this.smsService.sendVerificationSms(phoneNumber, code, user.id.getValue());
        this.logger.debug('SMS verification result', { sent: smsSent });
      } else {
        this.logger.debug('Phone numbers do not match - SMS not sent');
      }
    } else {
      this.logger.debug('SMS verification skipped', {
        phoneNumberProvided: !!phoneNumber,
        userHasPhone: !!user.profile?.phone,
      });
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
}
