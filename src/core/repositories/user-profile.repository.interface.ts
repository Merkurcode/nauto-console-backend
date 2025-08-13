import { UserProfile } from '@core/entities/user-profile.entity';
import { UserProfileId } from '@core/value-objects/user-profile-id.vo';
import { UserId } from '@core/value-objects/user-id.vo';

/**
 * User Profile repository interface
 *
 * Implementations:
 * - {@link UserProfile} - Production Prisma/PostgreSQL implementation
 */
export interface IUserProfileRepository {
  findById(id: UserProfileId): Promise<UserProfile | null>;
  findByUserId(userId: UserId): Promise<UserProfile | null>;
  create(userProfile: UserProfile): Promise<UserProfile>;
  update(userProfile: UserProfile): Promise<UserProfile>;
  delete(id: UserProfileId): Promise<void>;
}
