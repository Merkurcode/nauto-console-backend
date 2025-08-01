import { InvalidValueObjectException } from '@core/exceptions/domain-exceptions';

export class UserProfile {
  private readonly _phone?: string;
  private readonly _avatarUrl?: string;
  private readonly _bio?: string;
  private readonly _birthDate?: string;

  constructor(phone?: string, avatarUrl?: string, bio?: string, birthDate?: string) {
    this.validate(phone, avatarUrl, bio, birthDate);

    this._phone = phone?.trim();
    this._avatarUrl = avatarUrl?.trim();
    this._bio = bio?.trim();
    this._birthDate = birthDate?.trim();
  }

  private validate(phone?: string, avatarUrl?: string, bio?: string, birthDate?: string): void {
    if (phone && phone.trim().length === 0) {
      throw new InvalidValueObjectException('Phone cannot be empty when provided');
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
      this._avatarUrl === other._avatarUrl &&
      this._bio === other._bio &&
      this._birthDate === other._birthDate
    );
  }

  static empty(): UserProfile {
    return new UserProfile();
  }
}
