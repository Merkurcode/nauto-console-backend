import { AggregateRoot } from '@core/events/domain-event.base';
import { UserProfileId } from '@core/value-objects/user-profile-id.vo';
import { UserId } from '@core/value-objects/user-id.vo';

export interface IUserProfileProps {
  userId: UserId;
  phone?: string;
  phoneCountryCode?: string;
  avatarUrl?: string;
  bio?: string;
  birthdate?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class UserProfile extends AggregateRoot {
  private constructor(
    private readonly _id: UserProfileId,
    private readonly _props: IUserProfileProps,
  ) {
    super();
  }

  public static create(
    props: Omit<IUserProfileProps, 'createdAt' | 'updatedAt'>,
    id?: UserProfileId,
  ): UserProfile {
    const now = new Date();
    const profileId = id || UserProfileId.create();

    return new UserProfile(profileId, {
      ...props,
      createdAt: now,
      updatedAt: now,
    });
  }

  public static reconstruct(id: UserProfileId, props: IUserProfileProps): UserProfile {
    return new UserProfile(id, props);
  }

  // Getters
  public get id(): UserProfileId {
    return this._id;
  }

  public get userId(): UserId {
    return this._props.userId;
  }

  public get phone(): string | undefined {
    return this._props.phone;
  }

  public get phoneCountryCode(): string | undefined {
    return this._props.phoneCountryCode;
  }

  public get avatarUrl(): string | undefined {
    return this._props.avatarUrl;
  }

  public get bio(): string | undefined {
    return this._props.bio;
  }

  public get birthdate(): string | undefined {
    return this._props.birthdate;
  }

  public get createdAt(): Date {
    return this._props.createdAt;
  }

  public get updatedAt(): Date {
    return this._props.updatedAt;
  }

  // Business methods
  public updatePhone(phone?: string, countryCode?: string): void {
    if (phone && (!countryCode || countryCode.trim().length === 0)) {
      throw new Error('Country code is required when setting a phone number');
    }

    let hasChanges = false;

    if (this._props.phone !== phone) {
      this._props.phone = phone;
      hasChanges = true;
    }

    if (this._props.phoneCountryCode !== countryCode) {
      this._props.phoneCountryCode = countryCode;
      hasChanges = true;
    }

    if (hasChanges) {
      this.touch();
    }
  }

  public updateAvatarUrl(avatarUrl?: string): void {
    if (avatarUrl && !this.isValidUrl(avatarUrl)) {
      throw new Error('Invalid avatar URL format');
    }

    if (this._props.avatarUrl !== avatarUrl) {
      this._props.avatarUrl = avatarUrl;
      this.touch();
    }
  }

  public updateBio(bio?: string): void {
    if (bio && bio.length > 500) {
      throw new Error('Bio cannot exceed 500 characters');
    }

    if (this._props.bio !== bio) {
      this._props.bio = bio;
      this.touch();
    }
  }

  public updateBirthdate(birthdate?: string): void {
    if (birthdate && !this.isValidDateString(birthdate)) {
      throw new Error('Invalid birthdate format. Use YYYY-MM-DD');
    }

    if (this._props.birthdate !== birthdate) {
      this._props.birthdate = birthdate;
      this.touch();
    }
  }

  public updateProfile(updates: {
    phone?: string;
    phoneCountryCode?: string;
    avatarUrl?: string;
    bio?: string;
    birthdate?: string;
  }): void {
    let hasChanges = false;

    if (updates.phone !== undefined || updates.phoneCountryCode !== undefined) {
      if (updates.phone && !updates.phoneCountryCode) {
        throw new Error('Country code is required when setting a phone number');
      }

      if (this._props.phone !== updates.phone) {
        this._props.phone = updates.phone;
        hasChanges = true;
      }

      if (this._props.phoneCountryCode !== updates.phoneCountryCode) {
        this._props.phoneCountryCode = updates.phoneCountryCode;
        hasChanges = true;
      }
    }

    if (updates.avatarUrl !== undefined) {
      if (updates.avatarUrl && !this.isValidUrl(updates.avatarUrl)) {
        throw new Error('Invalid avatar URL format');
      }
      if (this._props.avatarUrl !== updates.avatarUrl) {
        this._props.avatarUrl = updates.avatarUrl;
        hasChanges = true;
      }
    }

    if (updates.bio !== undefined) {
      if (updates.bio && updates.bio.length > 500) {
        throw new Error('Bio cannot exceed 500 characters');
      }
      if (this._props.bio !== updates.bio) {
        this._props.bio = updates.bio;
        hasChanges = true;
      }
    }

    if (updates.birthdate !== undefined) {
      if (updates.birthdate && !this.isValidDateString(updates.birthdate)) {
        throw new Error('Invalid birthdate format. Use YYYY-MM-DD');
      }
      if (this._props.birthdate !== updates.birthdate) {
        this._props.birthdate = updates.birthdate;
        hasChanges = true;
      }
    }

    if (hasChanges) {
      this.touch();
    }
  }

  private touch(): void {
    this._props.updatedAt = new Date();
  }

  // Validation helpers
  private isValidUrl(url: string): boolean {
    try {
      new URL(url);

      return true;
    } catch {
      return false;
    }
  }

  private isValidDateString(dateString: string): boolean {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    if (!regex.test(dateString)) {
      return false;
    }

    const date = new Date(dateString);

    return date instanceof Date && !isNaN(date.getTime());
  }

  // Validation
  public isValid(): boolean {
    return !!this._props.userId;
  }
}
