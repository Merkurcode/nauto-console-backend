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
  emailVerified?: boolean;
  roles: string[];
  permissions?: string[];
  tenantId?: string;
  companyId?: string;
  jti?: string; // JWT ID - session token
  iat?: number;
  exp?: number;
}

export type AuthResponse =
  | IAuthTokenResponse
  | IOtpRequiredResponse
  | IEmailVerificationRequiredResponse;
