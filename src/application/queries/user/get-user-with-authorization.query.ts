import { IQuery, IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { UserService } from '@core/services/user.service';
import { IUserDetailResponse } from '@application/dtos/_responses/user/user.response';
import { UserMapper } from '@application/mappers/user.mapper';
import { UserAccessAuthorizationService } from '@core/services/user-access-authorization.service';
import { EntityNotFoundException } from '@core/exceptions/domain-exceptions';

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
      throw new EntityNotFoundException('Current User', currentUserId);
    }

    // Check authorization using domain service
    await this.userAccessAuthorizationService.validateUserAccess(currentUser, targetUser);

    // Use the mapper to convert to response DTO
    return UserMapper.toDetailResponse(targetUser);
  }
}
