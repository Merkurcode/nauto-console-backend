import { DomainEvent } from './domain-event.base';
import { UserProfileId } from '@core/value-objects/user-profile-id.vo';
import { UserId } from '@core/value-objects/user-id.vo';

/**
 * User Profile Domain Events
 * Following DDD: Events represent significant business moments in the User Profile lifecycle
 */

export class UserProfileCreatedEvent extends DomainEvent {
  constructor(
    public readonly profileId: UserProfileId,
    public readonly userId: UserId,
    public readonly firstName: string,
    public readonly lastName: string,
    public readonly phoneNumber?: string,
    public readonly dateOfBirth?: Date,
    public readonly timestamp?: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'user_profile.created';
  }
}

export class UserProfileUpdatedEvent extends DomainEvent {
  constructor(
    public readonly profileId: UserProfileId,
    public readonly userId: UserId,
    public readonly changes: {
      firstName?: string;
      lastName?: string;
      phoneNumber?: string;
      dateOfBirth?: Date;
      avatarUrl?: string;
      bio?: string;
    },
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'user_profile.updated';
  }
}

export class UserProfileDeletedEvent extends DomainEvent {
  constructor(
    public readonly profileId: UserProfileId,
    public readonly userId: UserId,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'user_profile.deleted';
  }
}

export class UserProfileAvatarUpdatedEvent extends DomainEvent {
  constructor(
    public readonly profileId: UserProfileId,
    public readonly userId: UserId,
    public readonly oldAvatarUrl?: string,
    public readonly newAvatarUrl?: string,
    public readonly timestamp?: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'user_profile.avatar_updated';
  }
}

export class UserProfilePhoneVerifiedEvent extends DomainEvent {
  constructor(
    public readonly profileId: UserProfileId,
    public readonly userId: UserId,
    public readonly phoneNumber: string,
    public readonly verifiedAt: Date,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'user_profile.phone_verified';
  }
}

export class UserProfileCompletedEvent extends DomainEvent {
  constructor(
    public readonly profileId: UserProfileId,
    public readonly userId: UserId,
    public readonly completionPercentage: number,
    public readonly completedFields: string[],
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'user_profile.completed';
  }
}

export class UserProfilePrivacySettingsUpdatedEvent extends DomainEvent {
  constructor(
    public readonly profileId: UserProfileId,
    public readonly userId: UserId,
    public readonly privacySettings: Record<string, unknown>,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'user_profile.privacy_settings_updated';
  }
}

export class UserProfileArchivedEvent extends DomainEvent {
  constructor(
    public readonly profileId: UserProfileId,
    public readonly userId: UserId,
    public readonly archivedAt: Date,
    public readonly reason: string,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'user_profile.archived';
  }
}
