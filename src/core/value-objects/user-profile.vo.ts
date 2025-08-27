import { InvalidValueObjectException } from '@core/exceptions/domain-exceptions';

export class UserProfile {
  private readonly _phone?: string;
  private readonly _phoneCountryCode?: string;
  private readonly _avatarUrl?: string;
  private readonly _bio?: string;
  private readonly _birthDate?: string;

  constructor(
    phone?: string,
    phoneCountryCode?: string,
    avatarUrl?: string,
    bio?: string,
    birthDate?: string,
  ) {
    this.validate(phone, phoneCountryCode, avatarUrl, bio, birthDate);

    this._phone = phone?.trim();
    this._phoneCountryCode = phoneCountryCode?.trim();
    this._avatarUrl = avatarUrl?.trim();
    this._bio = bio?.trim();
    this._birthDate = birthDate?.trim();
  }

  private validate(
    phone?: string,
    phoneCountryCode?: string,
    avatarUrl?: string,
    bio?: string,
    birthDate?: string,
  ): void {
    if (phone && phone.trim().length === 0) {
      throw new InvalidValueObjectException('Phone cannot be empty when provided');
    }

    if (phoneCountryCode && phoneCountryCode.trim().length === 0) {
      throw new InvalidValueObjectException('Phone country code cannot be empty when provided');
    }

    if (phoneCountryCode && (phoneCountryCode.length < 1 || phoneCountryCode.length > 5)) {
      throw new InvalidValueObjectException(
        'Phone country code must be between 1 and 5 characters',
      );
    }

    if (avatarUrl && avatarUrl.trim().length === 0) {
      throw new InvalidValueObjectException('Avatar URL cannot be empty when provided');
    }

    if (bio && bio.trim().length === 0) {
      throw new InvalidValueObjectException('Bio cannot be empty when provided');
    }

    if (birthDate && birthDate.trim().length === 0) {
      throw new InvalidValueObjectException('Birth date cannot be empty when provided');
    }

    if (phone && phone.length > 20) {
      throw new InvalidValueObjectException('Phone number is too long');
    }

    if (avatarUrl && avatarUrl.length > 500) {
      throw new InvalidValueObjectException('Avatar URL is too long');
    }

    if (bio && bio.length > 500) {
      throw new InvalidValueObjectException('Bio is too long');
    }

    if (birthDate && birthDate.length > 10) {
      throw new InvalidValueObjectException('Birth date format is invalid');
    }
  }

  get phone(): string | undefined {
    return this._phone;
  }

  get phoneCountryCode(): string | undefined {
    return this._phoneCountryCode;
  }

  get avatarUrl(): string | undefined {
    return this._avatarUrl;
  }

  get bio(): string | undefined {
    return this._bio;
  }

  get birthDate(): string | undefined {
    return this._birthDate;
  }

  equals(other: UserProfile): boolean {
    return (
      this._phone === other._phone &&
      this._phoneCountryCode === other._phoneCountryCode &&
      this._avatarUrl === other._avatarUrl &&
      this._bio === other._bio &&
      this._birthDate === other._birthDate
    );
  }

  static empty(): UserProfile {
    return new UserProfile();
  }
}
