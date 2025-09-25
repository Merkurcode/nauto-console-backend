import { User } from '@core/entities/user.entity';
import { Role } from '@core/entities/role.entity';
import { Otp } from '@core/entities/otp.entity';
import {
  IUserBaseResponse,
  IUserDetailResponse,
  IUserRoleResponse,
  IUserWithAuthResponse,
  IInvitationStatus,
} from '@application/dtos/_responses/user/user.response';

export class UserMapper {
  /**
   * Calculate OTP time remaining from expiration date
   */
  private static calculateOtpTimeRemaining(otp: Otp | null): string | undefined {
    if (!otp || otp.isExpired()) {
      return undefined;
    }

    const now = new Date();
    const timeRemainingMs = otp.expiresAt.getTime() - now.getTime();
    const minutesRemaining = Math.floor(timeRemainingMs / 60000);
    const secondsRemaining = Math.floor((timeRemainingMs % 60000) / 1000);

    if (minutesRemaining > 0) {
      return `${minutesRemaining} minute${minutesRemaining !== 1 ? 's' : ''} and ${secondsRemaining} second${secondsRemaining !== 1 ? 's' : ''}`;
    } else {
      return `${secondsRemaining} second${secondsRemaining !== 1 ? 's' : ''}`;
    }
  }

  /**
   * Calculate invitation status based on user state
   */
  private static calculateInvitationStatus(
    user: User,
    otp?: Otp | null,
  ): IInvitationStatus | undefined {
    // Use the User entity method to get the basic status
    const status = user.calculateInvitationStatus();

    // Build the detailed status object
    const baseDetails = {
      emailStatus: user.emailStatus,
      smsStatus: user.smsStatus,
      emailVerified: user.emailVerified,
    };

    switch (status) {
      case 'completed':
        return {
          status: 'completed',
          details: baseDetails,
        };

      case 'expired':
        return {
          status: 'expired',
          details: baseDetails,
        };

      case 'error':
        return {
          status: 'error',
          details: {
            ...baseDetails,
            errorMessage: user.lastEmailError || user.lastSmsError || 'Error sending invitation',
          },
        };

      case 'pending':
      default:
        const otpTimeRemaining = this.calculateOtpTimeRemaining(otp);

        return {
          status: 'pending',
          otpTimeRemaining,
          details: baseDetails,
        };
    }
  }

  /**
   * Maps a Role entity to a IUserRoleResponse DTO
   */
  static toRoleResponse(role: Role): IUserRoleResponse {
    return {
      id: role.id.getValue(),
      name: role.name,
    };
  }

  /**
   * Maps a User entity to a IUserBaseResponse DTO
   */
  static toBaseResponse(user: User): IUserBaseResponse {
    return {
      id: user.id.getValue(),
      email: user.email.getValue(),
      firstName: user.firstName.getValue(),
      lastName: user.lastName.getValue(),
      emailVerified: user.emailVerified,
    };
  }

  /**
   * Maps a User entity to a IUserDetailResponse DTO
   */
  static toDetailResponse(user: User, otp?: Otp | null): IUserDetailResponse {
    return {
      ...this.toBaseResponse(user),
      secondLastName: user.secondLastName?.getValue(),
      isActive: user.isActive,
      isReactivable: user.isReactivable,
      otpEnabled: user.otpEnabled,
      lastLoginAt: user.lastLoginAt,
      bannedUntil: user.bannedUntil,
      banReason: user.banReason,
      roles: user.roles?.map(role => this.toRoleResponse(role)) || [],
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      tenantId: user.getTenantId(),
      companyId: user.companyId?.getValue(),
      smsStatus: user.smsStatus,
      emailStatus: user.emailStatus,
      lastSmsError: user.lastSmsError,
      lastEmailError: user.lastEmailError,
      agentPhone: user.agentPhone?.getValue(),
      agentPhoneCountryCode: user.agentPhone?.getCountryCode(),
      profile: user.profile
        ? {
            phone: user.profile.phone,
            phoneCountryCode: user.profile.phoneCountryCode,
            avatarUrl: user.profile.avatarUrl,
            bio: user.profile.bio,
            birthDate: user.profile.birthDate,
          }
        : undefined,
      address: user.address
        ? {
            countryId: user.address.countryId?.getValue(),
            countryName: user.countryName,
            stateId: user.address.stateId?.getValue(),
            stateName: user.stateName,
            city: user.address.city,
            street: user.address.street,
            exteriorNumber: user.address.exteriorNumber,
            interiorNumber: user.address.interiorNumber,
            postalCode: user.address.postalCode,
          }
        : undefined,
      invitationStatus: this.calculateInvitationStatus(user, otp),
    };
  }

  /**
   * Maps a User entity to a IUserWithAuthResponse DTO
   */
  static toAuthResponse(user: User): IUserWithAuthResponse {
    return {
      ...this.toBaseResponse(user),
      roles: user.roles?.map(role => this.toRoleResponse(role)) || [],
      companyId: user.companyId?.getValue(),
      tenantId: user.getTenantId(),
    };
  }
}
