import { IQuery, IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Injectable, Inject } from '@nestjs/common';
import { UserService } from '@core/services/user.service';
import { IUserDetailResponse } from '@application/dtos/_responses/user/user.response';
import { UserMapper } from '@application/mappers/user.mapper';
import { UserAuthorizationService } from '@core/services/user-authorization.service';
import { EntityNotFoundException } from '@core/exceptions/domain-exceptions';
import { IOtpRepository } from '@core/repositories/otp.repository.interface';
import { OTP_REPOSITORY } from '@shared/constants/tokens';
import { UserRoleHierarchyService } from '@core/services/user-role-hierarchy.service';

export class GetUsersQuery implements IQuery {
  constructor(
    public readonly companyId: string,
    public readonly currentUserId: string,
  ) {}
}

@Injectable()
@QueryHandler(GetUsersQuery)
export class GetUsersQueryHandler implements IQueryHandler<GetUsersQuery> {
  constructor(
    private readonly userService: UserService,
    private readonly userAuthorizationService: UserAuthorizationService,
    @Inject(OTP_REPOSITORY)
    private readonly otpRepository: IOtpRepository,
    private readonly userRoleHierarchyService: UserRoleHierarchyService,
  ) {}

  async execute(query: GetUsersQuery): Promise<IUserDetailResponse[]> {
    const { companyId, currentUserId } = query;

    // Get current user
    const currentUser = await this.userService.getUserById(currentUserId);
    if (!currentUser) {
      throw new EntityNotFoundException('User', currentUserId);
    }

    // Delegate authorization check to domain service
    // This will throw appropriate domain exceptions if not authorized
    this.userAuthorizationService.validateCanQueryCompanyUsers(currentUser, companyId);

    // Get users from service
    const users = await this.userService.getAllUsers(companyId);

    // Check if current user has privileged access (ROOT, ROOT_READONLY, or BOT)
    const hasPrivilegedAccess = this.userRoleHierarchyService.hasPrivilegedRole(currentUser);

    // Filter out privileged users if current user doesn't have privileged access
    const filteredUsers = hasPrivilegedAccess
      ? users
      : users.filter(user => {
          const hasPrivilegedRole = this.userRoleHierarchyService.hasPrivilegedRole(user);

          return !hasPrivilegedRole;
        });

    // Use the mapper to convert each user to response DTO with OTP information
    const userResponses = await Promise.all(
      filteredUsers.map(async user => {
        // Get current OTP for user if they haven't verified email yet
        const otp = !user.emailVerified
          ? await this.otpRepository.findByUserId(user.id.getValue())
          : null;

        return UserMapper.toDetailResponse(user, otp);
      }),
    );

    return userResponses;
  }
}
