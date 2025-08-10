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

export interface IUserDetailResponse extends IUserBaseResponse {
  isActive: boolean;
  otpEnabled: boolean;
  lastLoginAt?: Date;
  roles: IUserRoleResponse[];
  createdAt: Date;
  updatedAt: Date;
  tenantId?: string;
  companyId?: string;
}

export interface IUserWithAuthResponse extends IUserBaseResponse {
  roles: IUserRoleResponse[];
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
