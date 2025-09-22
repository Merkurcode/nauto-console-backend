import { IQuery, IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Injectable, Inject } from '@nestjs/common';
import { ISearchUsersResponse, IJwtPayload } from '@application/dtos/_responses/user/user.response';
import { IUserRepository } from '@core/repositories/user.repository.interface';
import { USER_REPOSITORY } from '@shared/constants/tokens';
import { UserAuthorizationService } from '@core/services/user-authorization.service';
import { ForbiddenActionException } from '@core/exceptions/domain-exceptions';

export class SearchUsersQuery implements IQuery {
  constructor(
    public readonly companyId: string, // Required for multi-tenant isolation
    public readonly limit: number = 20,
    public readonly offset: number = 0,
    public readonly onlyActive: boolean = true,
    public readonly onlyEmailVerified: boolean = false,
    public readonly currentUser?: IJwtPayload,
    public readonly query?: string,
  ) {}
}

@Injectable()
@QueryHandler(SearchUsersQuery)
export class SearchUsersQueryHandler implements IQueryHandler<SearchUsersQuery> {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    private readonly userAuthorizationService: UserAuthorizationService,
  ) {}

  async execute(query: SearchUsersQuery): Promise<ISearchUsersResponse> {
    const {
      query: searchQuery,
      companyId,
      limit,
      offset,
      onlyActive,
      onlyEmailVerified,
      currentUser,
    } = query;

    if (!this.userAuthorizationService.canAccessCompany(currentUser, companyId)) {
      throw new ForbiddenActionException('You can only access your assigned company resources');
    }

    const result = await this.userRepository.searchUsers({
      query: searchQuery,
      companyId: companyId,
      limit,
      offset,
      onlyActive,
      onlyEmailVerified,
    });

    return {
      users: result.users,
      totalCount: result.totalCount,
      limit,
      offset,
      hasMore: result.hasMore,
    };
  }
}
