export interface IUserRoleResponse {
  id: string;
  name: string;
}

export interface IUserDetailResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  otpEnabled: boolean;
  emailVerified?: boolean;
  lastLoginAt?: Date;
  roles: IUserRoleResponse[];
  createdAt: Date;
  updatedAt: Date;
  tenantId?: string;
  companyId?: string;
}
