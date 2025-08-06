import { IQuery, IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Injectable, Inject, ForbiddenException } from '@nestjs/common';
import { IUserRepository } from '@core/repositories/user.repository.interface';
import { IUserDetailResponse } from '@application/dtos/responses/user.response';
import { UserMapper } from '@application/mappers/user.mapper';
import { UserAuthorizationService } from '@core/services/user-authorization.service';
import { USER_REPOSITORY } from '@shared/constants/tokens';

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
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    private readonly userAuthorizationService: UserAuthorizationService,
  ) {}

  async execute(query: GetUsersQuery): Promise<IUserDetailResponse[]> {
    const { companyId, currentUserId } = query;

    // Get current user to check authorization
    const currentUser = await this.userRepository.findById(currentUserId);
    if (!currentUser) {
      throw new ForbiddenException('User not found');
    }

    // Check if user can query users from this company
    if (!this.userAuthorizationService.canQueryCompanyUsers(currentUser, companyId)) {
      throw new ForbiddenException('Admin users can only query users from their own company');
    }

    const users = await this.userRepository.findAllByCompanyId(companyId);

    // Use the mapper to convert each user to response DTO
    return users.map(user => UserMapper.toDetailResponse(user));
  }
}
