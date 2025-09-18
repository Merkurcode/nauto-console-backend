import { ICommand, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable, Inject } from '@nestjs/common';
import { UserService } from '@core/services/user.service';
import {
  EntityNotFoundException,
  BusinessRuleValidationException,
  ForbiddenActionException,
} from '@core/exceptions/domain-exceptions';
import { IOtpRepository } from '@core/repositories/otp.repository.interface';
import { ICompanyRepository } from '@core/repositories/company.repository.interface';
import { OTP_REPOSITORY, COMPANY_REPOSITORY } from '@shared/constants/tokens';
import { CompanyId } from '@core/value-objects/company-id.vo';
import { UserAuthorizationService } from '@core/services/user-authorization.service';

export class ResendUserInvitationCommand implements ICommand {
  constructor(
    public readonly userId: string,
    public readonly password: string | undefined | null,
    public readonly currentUserId: string,
  ) {}
}

@Injectable()
@CommandHandler(ResendUserInvitationCommand)
export class ResendUserInvitationCommandHandler
  implements ICommandHandler<ResendUserInvitationCommand>
{
  constructor(
    private readonly userService: UserService,
    @Inject(OTP_REPOSITORY)
    private readonly otpRepository: IOtpRepository,
    @Inject(COMPANY_REPOSITORY)
    private readonly companyRepository: ICompanyRepository,
    private readonly userAuthorizationService: UserAuthorizationService,
  ) {}

  async execute(command: ResendUserInvitationCommand): Promise<{ message: string }> {
    const { userId, password, currentUserId } = command;

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

    // Calculate invitation status to validate resend
    const invitationStatus = targetUser.calculateInvitationStatus();

    // Only allow resend of pending, expired, or error invitations
    if (invitationStatus === 'completed') {
      throw new BusinessRuleValidationException(
        'Cannot resend invitation for a user who has already completed verification',
      );
    }

    // Store user data before deletion
    const userData = {
      email: targetUser.email.getValue(),
      firstName: targetUser.firstName.getValue(),
      lastName: targetUser.lastName.getValue(),
      secondLastName: targetUser.secondLastName?.getValue(),
      companyId: targetUser.companyId?.getValue(),
      roles: targetUser.roles?.map(role => role.name) || [],
      agentPhone: targetUser.agentPhone?.getValue(),
      agentPhoneCountryCode: targetUser.agentPhone?.getCountryCode(),
      profile: targetUser.profile
        ? {
            phone: targetUser.profile.phone,
            phoneCountryCode: targetUser.profile.phoneCountryCode,
            avatarUrl: targetUser.profile.avatarUrl,
            bio: targetUser.profile.bio,
            birthDate: targetUser.profile.birthDate,
          }
        : undefined,
      address: targetUser.address
        ? {
            country: targetUser.address.countryId?.getValue(), // Pass ID as string, service will handle it
            state: targetUser.address.stateId?.getValue(), // Pass ID as string, service will handle it
            city: targetUser.address.city,
            street: targetUser.address.street,
            exteriorNumber: targetUser.address.exteriorNumber,
            interiorNumber: targetUser.address.interiorNumber,
            postalCode: targetUser.address.postalCode,
          }
        : undefined,
    };

    // Get company name for recreation
    let companyName: string | undefined;
    if (targetUser.companyId) {
      const companyIdVO = CompanyId.fromString(targetUser.companyId.getValue());
      const company = await this.companyRepository.findById(companyIdVO);
      companyName = company?.name.getValue();
    }

    // Delete existing OTP if exists
    const existingOtp = await this.otpRepository.findByUserId(userId);
    if (existingOtp) {
      await this.otpRepository.delete(existingOtp.id);
    }

    // Delete the user
    await this.userService.deleteUser(userId, currentUserId);

    // Recreate the user with the same data (this will trigger new invitation emails/SMS)
    await this.userService.createUserWithExtendedData(
      userData.email,
      password,
      userData.firstName,
      userData.lastName,
      {
        userId: targetUser.id,
        secondLastName: userData.secondLastName,
        isActive: true,
        emailVerified: false, // Reset to false to trigger new verification
        agentPhone: userData.agentPhone,
        agentPhoneCountryCode: userData.agentPhoneCountryCode,
        profile: userData.profile,
        address: userData.address,
        companyName: companyName,
        roles: userData.roles,
      },
    );

    return {
      message: `User invitation resent successfully. New invitation emails and SMS have been sent to ${userData.email}.`,
    };
  }
}
