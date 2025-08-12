/**
 * Interface for user profile update service input
 * Defines the exact structure expected by UserService.updateUserProfile method
 */
export interface IUpdateUserProfileServiceInput {
  firstName?: string;
  lastName?: string;
  secondLastName?: string;
  isActive?: boolean;
  emailVerified?: boolean;
  bannedUntil?: string | Date;
  banReason?: string;
  agentPhone?: string;
  agentPhoneCountryCode?: string;
  profile?: IProfileUpdateInput;
  address?: IAddressUpdateInput;
}

/**
 * Interface for profile data updates
 */
export interface IProfileUpdateInput {
  phone?: string;
  phoneCountryCode?: string;
  avatarUrl?: string;
  bio?: string;
  birthDate?: string | Date;
}

/**
 * Interface for address data updates
 */
export interface IAddressUpdateInput {
  city?: string;
  street?: string;
  exteriorNumber?: string;
  interiorNumber?: string;
  postalCode?: string;
}
