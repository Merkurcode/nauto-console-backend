import { ApiProperty } from '@nestjs/swagger';

// User response interfaces

export interface IUserRoleResponse {
  id: string;
  name: string;
}

export interface IUserBaseResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  emailVerified?: boolean;
}

export interface IInvitationStatus {
  status: 'pending' | 'completed' | 'error' | 'expired';
  otpTimeRemaining?: string;
  details?: {
    emailStatus: string;
    smsStatus: string;
    emailVerified: boolean;
    errorMessage?: string;
  };
}

export interface IUserProfileResponse {
  phone?: string;
  phoneCountryCode?: string;
  avatarUrl?: string;
  bio?: string;
  birthDate?: string;
}

export interface IUserAddressResponse {
  countryId?: string;
  countryName?: string;
  stateId?: string;
  stateName?: string;
  city?: string;
  street?: string;
  exteriorNumber?: string;
  interiorNumber?: string;
  postalCode?: string;
}

export interface IUserDetailResponse extends IUserBaseResponse {
  secondLastName?: string;
  isActive: boolean;
  isReactivable: boolean;
  otpEnabled: boolean;
  lastLoginAt?: Date;
  bannedUntil?: Date;
  banReason?: string;
  roles: IUserRoleResponse[];
  createdAt: Date;
  updatedAt: Date;
  tenantId?: string;
  companyId?: string;
  smsStatus: string;
  emailStatus: string;
  lastSmsError?: string;
  lastEmailError?: string;
  agentPhone?: string;
  agentPhoneCountryCode?: string;
  profile?: IUserProfileResponse;
  address?: IUserAddressResponse;
  invitationStatus?: IInvitationStatus;
}

export interface IUserWithAuthResponse extends IUserBaseResponse {
  roles: IUserRoleResponse[];
  companyId?: string;
  tenantId?: string;
}

export interface IAuthTokenResponse {
  accessToken: string;
  refreshToken: string;
  user: IUserWithAuthResponse;
  message?: string;
}

export interface IOtpRequiredResponse {
  requiresOtp: true;
  userId: string;
  message: string;
}

export interface IEmailVerificationRequiredResponse {
  requiresEmailVerification: true;
  userId: string;
  email: string;
  message: string;
}

export interface IAuthRefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
}

export interface IJwtPayload {
  sub: string;
  email: string;
  isBanned: boolean; // User ban status
  bannedUntil: Date | null | undefined; // Optional, if user is banned
  banReason: string | null | undefined; // Optional, if user is banned
  emailVerified?: boolean;
  isActive: boolean;
  roles: string[];
  permissions?: string[];
  tenantId?: string;
  companyId?: string;
  jti?: string; // JWT ID - session token
  tokenId?: string; // BOT token identifier
  isBotToken?: boolean; // Flag to identify BOT tokens
  iat?: number;
  exp?: number;
}

export type AuthResponse =
  | IAuthTokenResponse
  | IOtpRequiredResponse
  | IEmailVerificationRequiredResponse;

export interface ISearchUsersResponse {
  users: IUserDetailResponse[];
  totalCount: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export class SearchUsersResponseDto implements ISearchUsersResponse {
  @ApiProperty({ description: 'Array of users with full details', type: 'array' })
  users: IUserDetailResponse[];

  @ApiProperty({ description: 'Total number of matching users' })
  totalCount: number;

  @ApiProperty({ description: 'Number of results returned' })
  limit: number;

  @ApiProperty({ description: 'Number of results skipped' })
  offset: number;

  @ApiProperty({ description: 'Whether there are more results available' })
  hasMore: boolean;
}
