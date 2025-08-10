import { IQuery, IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { UserService } from '@core/services/user.service';
import { IUserDetailResponse } from '@application/dtos/_responses/user/user.response';
import { UserMapper } from '@application/mappers/user.mapper';
import { UserAuthorizationService } from '@core/services/user-authorization.service';
import { EntityNotFoundException } from '@core/exceptions/domain-exceptions';

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

    // Use the mapper to convert each user to response DTO
    return users.map(user => UserMapper.toDetailResponse(user));
  }
}
