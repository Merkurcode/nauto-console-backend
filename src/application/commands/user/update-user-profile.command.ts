import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable, Inject, ForbiddenException, NotFoundException } from '@nestjs/common';
import { IUserRepository } from '@core/repositories/user.repository.interface';
import { UserAccessAuthorizationService } from '@core/services/user-access-authorization.service';
import { IUserDetailResponse } from '@application/dtos/responses/user.response';
import { UserMapper } from '@application/mappers/user.mapper';
import { USER_REPOSITORY } from '@shared/constants/tokens';
import { UpdateUserProfileDto } from '@application/dtos/user/update-user-profile.dto';
import { FirstName, LastName } from '@core/value-objects/name.vo';
import { SecondLastName } from '@core/value-objects/second-lastname.vo';
import { AgentPhone } from '@core/value-objects/agent-phone.vo';
import { UserProfile } from '@core/value-objects/user-profile.vo';
import { Address } from '@core/value-objects/address.vo';

export class UpdateUserProfileCommand {
  constructor(
    public readonly targetUserId: string,
    public readonly currentUserId: string,
    public readonly updateData: UpdateUserProfileDto,
  ) {}
}

@Injectable()
@CommandHandler(UpdateUserProfileCommand)
export class UpdateUserProfileCommandHandler
  implements ICommandHandler<UpdateUserProfileCommand, IUserDetailResponse>
{
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    private readonly userAccessAuthorizationService: UserAccessAuthorizationService,
  ) {}

  async execute(command: UpdateUserProfileCommand): Promise<IUserDetailResponse> {
    const { targetUserId, currentUserId, updateData } = command;

    // Get both users
    const [targetUser, currentUser] = await Promise.all([
      this.userRepository.findById(targetUserId),
      this.userRepository.findById(currentUserId),
    ]);

    if (!targetUser) {
      throw new NotFoundException(`User with ID "${targetUserId}" not found`);
    }

    if (!currentUser) {
      throw new ForbiddenException('Current user not found');
    }

    // Check authorization using the same domain service as GET endpoint
    await this.userAccessAuthorizationService.validateUserAccess(currentUser, targetUser);

    // Update user data based on provided fields
    let hasChanges = false;

    // Update basic profile information (firstName and lastName)
    if (updateData.firstName || updateData.lastName) {
      const firstName = new FirstName(updateData.firstName || targetUser.firstName.getValue());
      const lastName = new LastName(updateData.lastName || targetUser.lastName.getValue());
      targetUser.updateProfile(firstName, lastName);
      hasChanges = true;
    }

    // Update second last name if provided
    if (updateData.secondLastName !== undefined) {
      const secondLastName = updateData.secondLastName
        ? new SecondLastName(updateData.secondLastName)
        : undefined;
      targetUser.setSecondLastName(secondLastName);
      hasChanges = true;
    }

    // Update activation status
    if (updateData.isActive !== undefined) {
      if (updateData.isActive && !targetUser.isActive) {
        targetUser.activate();
        hasChanges = true;
      } else if (!updateData.isActive && targetUser.isActive) {
        targetUser.deactivate();
        hasChanges = true;
      }
    }

    // Update email verification status
    if (updateData.emailVerified !== undefined) {
      if (updateData.emailVerified && !targetUser.emailVerified) {
        targetUser.markEmailAsVerified();
        hasChanges = true;
      }
    }

    // Update ban status - handle both fields independently
    if (updateData.bannedUntil !== undefined || updateData.banReason !== undefined) {
      // If both are provided and not null/empty
      if (updateData.bannedUntil && updateData.banReason) {
        const banDate = new Date(updateData.bannedUntil);
        targetUser.banUser(banDate, updateData.banReason);
        hasChanges = true;
      }
      // If either is null/empty, unban the user
      else if (
        updateData.bannedUntil === null ||
        updateData.banReason === null ||
        updateData.bannedUntil === '' ||
        updateData.banReason === ''
      ) {
        targetUser.unbanUser();
        hasChanges = true;
      }
    }

    // Update agent phone
    if (updateData.agentPhone !== undefined) {
      const agentPhone = updateData.agentPhone
        ? new AgentPhone(updateData.agentPhone, updateData.agentPhoneCountryCode)
        : undefined;
      targetUser.setAgentPhone(agentPhone);
      hasChanges = true;
    }

    // Update profile information (phone, avatar, bio, birthDate)
    if (updateData.profile) {
      const currentProfile = targetUser.profile;

      // Build new profile with provided values or keep existing ones
      const newProfile = new UserProfile(
        updateData.profile.phone !== undefined ? updateData.profile.phone : currentProfile?.phone,
        updateData.profile.phoneCountryCode !== undefined
          ? updateData.profile.phoneCountryCode
          : currentProfile?.phoneCountryCode,
        updateData.profile.avatarUrl !== undefined
          ? updateData.profile.avatarUrl
          : currentProfile?.avatarUrl,
        updateData.profile.bio !== undefined ? updateData.profile.bio : currentProfile?.bio,
        updateData.profile.birthDate !== undefined
          ? updateData.profile.birthDate
          : currentProfile?.birthDate,
      );
      targetUser.setProfile(newProfile);
      hasChanges = true;
    }

    // Update address information
    if (updateData.address) {
      const currentAddress = targetUser.address;

      // Build new address with provided values or keep existing ones
      const newAddress = new Address(
        updateData.address.country !== undefined
          ? updateData.address.country
          : currentAddress?.country,
        updateData.address.state !== undefined ? updateData.address.state : currentAddress?.state,
        updateData.address.city !== undefined ? updateData.address.city : currentAddress?.city,
        updateData.address.street !== undefined
          ? updateData.address.street
          : currentAddress?.street,
        updateData.address.exteriorNumber !== undefined
          ? updateData.address.exteriorNumber
          : currentAddress?.exteriorNumber,
        updateData.address.postalCode !== undefined
          ? updateData.address.postalCode
          : currentAddress?.postalCode,
        updateData.address.interiorNumber !== undefined
          ? updateData.address.interiorNumber
          : currentAddress?.interiorNumber,
        updateData.address.googleMapsUrl !== undefined
          ? updateData.address.googleMapsUrl
          : currentAddress?.googleMapsUrl,
      );
      targetUser.setAddress(newAddress);
      hasChanges = true;
    }

    // Save changes if any were made
    const updatedUser = hasChanges ? await this.userRepository.update(targetUser) : targetUser;

    return UserMapper.toDetailResponse(updatedUser);
  }
}
