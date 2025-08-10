import {
  IUserDetailResponse as IUserDetailResponseOriginal,
  IUserRoleResponse as IUserRoleResponseOriginal,
} from '@application/dtos/_responses/user/user.response';
import {
  IUserDetailResponse,
  IUserRoleResponse,
} from '@application/dtos/_responses/user/user-detail.response.interface';

export class UserDetailResponseMapper {
  public static toUserRoleResponse(source: IUserRoleResponseOriginal): IUserRoleResponse {
    return {
      id: source.id,
      name: source.name,
    };
  }

  public static toUserDetailResponse(source: IUserDetailResponseOriginal): IUserDetailResponse {
    return {
      id: source.id,
      email: source.email,
      firstName: source.firstName,
      lastName: source.lastName,
      isActive: source.isActive,
      otpEnabled: source.otpEnabled,
      emailVerified: source.emailVerified,
      lastLoginAt: source.lastLoginAt,
      roles: source.roles.map(this.toUserRoleResponse),
      createdAt: source.createdAt,
      updatedAt: source.updatedAt,
      tenantId: source.tenantId,
      companyId: source.companyId,
    };
  }
}
