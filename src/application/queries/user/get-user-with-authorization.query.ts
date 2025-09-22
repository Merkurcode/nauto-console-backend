import { IQuery, IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Injectable, Inject } from '@nestjs/common';
import { UserService } from '@core/services/user.service';
import { IUserDetailResponse } from '@application/dtos/_responses/user/user.response';
import { UserMapper } from '@application/mappers/user.mapper';
import { UserAccessAuthorizationService } from '@core/services/user-access-authorization.service';
import { UserRoleHierarchyService } from '@core/services/user-role-hierarchy.service';
import { EntityNotFoundException } from '@core/exceptions/domain-exceptions';
import { IOtpRepository } from '@core/repositories/otp.repository.interface';
import { OTP_REPOSITORY } from '@shared/constants/tokens';

export class GetUserWithAuthorizationQuery implements IQuery {
  constructor(
    public readonly targetUserId: string,
    public readonly currentUserId: string,
  ) {}
}

@Injectable()
@QueryHandler(GetUserWithAuthorizationQuery)
export class GetUserWithAuthorizationQueryHandler
  implements IQueryHandler<GetUserWithAuthorizationQuery>
{
  constructor(
    private readonly userService: UserService,
    private readonly userAccessAuthorizationService: UserAccessAuthorizationService,
    private readonly userRoleHierarchyService: UserRoleHierarchyService,
    @Inject(OTP_REPOSITORY)
    private readonly otpRepository: IOtpRepository,
  ) {}

  async execute(query: GetUserWithAuthorizationQuery): Promise<IUserDetailResponse> {
    const { targetUserId, currentUserId } = query;

    // Get both users
    const [targetUser, currentUser] = await Promise.all([
      this.userService.getUserById(targetUserId),
      this.userService.getUserById(currentUserId),
    ]);

    if (!targetUser) {
      throw new EntityNotFoundException('User', targetUserId);
    }

    if (!currentUser) {
      throw new EntityNotFoundException('User', currentUserId);
    }

    // Check authorization using domain service
    await this.userAccessAuthorizationService.validateUserAccess(currentUser, targetUser);

    // Check role hierarchy access
    this.userRoleHierarchyService.validateCanAccessUser(currentUser, targetUser);

    // Get current OTP for user if they haven't verified email yet
    const otp = !targetUser.emailVerified
      ? await this.otpRepository.findByUserId(targetUser.id.getValue())
      : null;

    // Use the mapper to convert to response DTO
    return UserMapper.toDetailResponse(targetUser, otp);
  }
}
