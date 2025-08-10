import { Injectable, Inject } from '@nestjs/common';
import { UserProfile } from '@core/entities/user-profile.entity';
import { IUserProfileRepository } from '@core/repositories/user-profile.repository.interface';
import { USER_PROFILE_REPOSITORY } from '@shared/constants/tokens';
import { UserId } from '@core/value-objects/user-id.vo';
import { UserProfileId } from '@core/value-objects/user-profile-id.vo';
import { EntityNotFoundException } from '@core/exceptions/domain-exceptions';

@Injectable()
export class UserProfileService {
  constructor(
    @Inject(USER_PROFILE_REPOSITORY)
    private readonly userProfileRepository: IUserProfileRepository,
  ) {}

  async createUserProfile(
    userId: UserId,
    profileData: {
      phone?: string;
      phoneCountryCode?: string;
      avatarUrl?: string;
      bio?: string;
      birthdate?: string;
    },
  ): Promise<UserProfile> {
    // Check if profile already exists
    const existingProfile = await this.userProfileRepository.findByUserId(userId);
    if (existingProfile) {
      throw new Error('User profile already exists');
    }

    const profile = UserProfile.create({
      userId,
      ...profileData,
    });

    return await this.userProfileRepository.create(profile);
  }

  async updateUserProfile(
    userProfileId: UserProfileId,
    updates: {
      phone?: string;
      phoneCountryCode?: string;
      avatarUrl?: string;
      bio?: string;
      birthdate?: string;
    },
  ): Promise<UserProfile> {
    const profile = await this.userProfileRepository.findById(userProfileId);
    if (!profile) {
      throw new EntityNotFoundException('UserProfile', userProfileId.getValue());
    }

    profile.updateProfile(updates);

    return await this.userProfileRepository.update(profile);
  }

  async getUserProfile(userId: UserId): Promise<UserProfile | null> {
    return await this.userProfileRepository.findByUserId(userId);
  }

  async getUserProfileById(profileId: UserProfileId): Promise<UserProfile | null> {
    return await this.userProfileRepository.findById(profileId);
  }

  async deleteUserProfile(userProfileId: UserProfileId): Promise<void> {
    const profile = await this.userProfileRepository.findById(userProfileId);
    if (!profile) {
      throw new EntityNotFoundException('UserProfile', userProfileId.getValue());
    }

    await this.userProfileRepository.delete(userProfileId);
  }
}
