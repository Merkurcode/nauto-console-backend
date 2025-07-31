import { ICommand, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { SendVerificationEmailDto } from '@application/dtos/auth/email-verification.dto';
import { Injectable, Inject, Logger, ForbiddenException, ConflictException } from '@nestjs/common';
import { AuthService } from '@core/services/auth.service';
import { EmailService } from '@core/services/email.service';
import { SmsService } from '@core/services/sms.service';
import { IUserRepository } from '@core/repositories/user.repository.interface';
import { ICompanyRepository } from '@core/repositories/company.repository.interface';
import { USER_REPOSITORY, COMPANY_REPOSITORY } from '@shared/constants/tokens';
import { EntityNotFoundException } from '@core/exceptions/domain-exceptions';
import { Email } from '@core/value-objects/email.vo';
import { RolesEnum } from '@shared/constants/enums';

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
  private readonly logger = new Logger(SendVerificationEmailCommandHandler.name);

  constructor(
    private readonly authService: AuthService,
    private readonly emailService: EmailService,
    private readonly smsService: SmsService,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(COMPANY_REPOSITORY)
    private readonly companyRepository: ICompanyRepository,
  ) {}

  async execute(command: SendVerificationEmailCommand): Promise<{ message: string }> {
    const { email, phoneNumber } = command.dto;
    const { currentUserId, currentUserRoles, currentUserCompanyId } = command;

    // Validate email format using value object
    const _emailVO = new Email(email);

    // SECURITY: Verify that the email is registered in the system
    const targetUser = await this.userRepository.findByEmail(email);
    if (!targetUser) {
      throw new EntityNotFoundException('User with this email is not registered', email);
    }

    // SECURITY: Check if email is already verified
    if (targetUser.emailVerified) {
      throw new ConflictException('Email is already verified');
    }

    // SECURITY: Validate access permissions
    await this.validateAccess(
      email,
      currentUserId,
      currentUserRoles,
      currentUserCompanyId,
    );

    // Generate a verification code
    const code = await this.authService.generateEmailVerificationCode(email);

    // Send the verification email
    const emailSent = await this.emailService.sendVerificationEmail(email, code);

    // Send SMS if phone number is provided (and user has phone number)
    let smsSent = false;
    if (phoneNumber && targetUser.profile?.phone) {
      this.logger.debug('SMS verification requested', {
        phoneNumberProvided: !!phoneNumber,
        userHasPhone: !!targetUser.profile?.phone,
        userId: targetUser.id.getValue(),
      });

      // Verify the provided phone number matches the user's registered phone
      if (targetUser.profile.phone === phoneNumber) {
        this.logger.debug('Phone numbers match, sending SMS verification');
        smsSent = await this.smsService.sendVerificationSms(phoneNumber, code, targetUser.id.getValue());
        this.logger.debug('SMS verification result', { sent: smsSent });
      } else {
        this.logger.debug('Phone numbers do not match - SMS not sent');
      }
    } else {
      this.logger.debug('SMS verification skipped', {
        phoneNumberProvided: !!phoneNumber,
        userHasPhone: !!targetUser.profile?.phone,
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

  private async validateAccess(
    email: string,
    currentUserId: string,
    currentUserRoles: string[],
    currentUserCompanyId: string | null,
  ): Promise<void> {
    // Rule 1: Root role can send verification to any email
    if (currentUserRoles.includes(RolesEnum.ROOT)) {
      return;
    }

    // Find the target user by email
    const targetUser = await this.userRepository.findByEmail(email);
    if (!targetUser) {
      throw new EntityNotFoundException('User with this email is not registered', email);
    }

    // Rule 2: Admin can send to emails within their company and subsidiary companies
    if (currentUserRoles.includes(RolesEnum.ADMIN)) {
      if (currentUserCompanyId && targetUser.companyId) {
        // Check if target user is in the same company
        if (targetUser.companyId.getValue() === currentUserCompanyId) {
          return;
        }

        // Check if target user's company is a subsidiary of current user's company
        const targetCompany = await this.companyRepository.findById(targetUser.companyId);
        if (targetCompany && await this.isSubsidiaryCompany(currentUserCompanyId, targetCompany.id.getValue())) {
          return;
        }
      }

      // Admin can also send to their own email
      if (targetUser.id.getValue() === currentUserId) {
        return;
      }

      throw new ForbiddenException(
        'You can only send verification emails to users within your company, subsidiary companies, or your own email',
      );
    }

    // Rule 3: Manager can send to emails within their company
    if (currentUserRoles.includes(RolesEnum.MANAGER)) {
      if (currentUserCompanyId && targetUser.companyId) {
        if (targetUser.companyId.getValue() === currentUserCompanyId) {
          return;
        }
      }

      // Manager can also send to their own email
      if (targetUser.id.getValue() === currentUserId) {
        return;
      }

      throw new ForbiddenException(
        'You can only send verification emails to users within your company or your own email',
      );
    }

    // Rule 4: Other roles can only send verification to their own email
    if (targetUser.id.getValue() !== currentUserId) {
      throw new ForbiddenException('You can only send verification emails to your own email');
    }
  }

  private async isSubsidiaryCompany(parentCompanyId: string, targetCompanyId: string): Promise<boolean> {
    try {
      const targetCompany = await this.companyRepository.findById({ getValue: () => targetCompanyId } as any);
      if (!targetCompany) {
        return false;
      }

      // Check if the target company's parent is the current user's company
      return targetCompany.isSubsidiaryOf({ getValue: () => parentCompanyId } as any);
    } catch (error) {
      this.logger.error('Error checking subsidiary relationship', { error: error.message, parentCompanyId, targetCompanyId });
      return false;
    }
  }
}
