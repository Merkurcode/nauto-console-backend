import { IQuery, IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Injectable, Inject } from '@nestjs/common';
import { IUserRepository } from '@core/repositories/user.repository.interface';
import { IUserDetailResponse } from '@application/dtos/responses/user.response';
import { UserMapper } from '@application/mappers/user.mapper';
import { UserAuthorizationService } from '@core/services/user-authorization.service';
import { USER_REPOSITORY } from '@shared/constants/tokens';
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
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    private readonly userAuthorizationService: UserAuthorizationService,
  ) {}

  async execute(query: GetUsersQuery): Promise<IUserDetailResponse[]> {
    const { companyId, currentUserId } = query;

    // Get current user
    const currentUser = await this.userRepository.findById(currentUserId);
    if (!currentUser) {
      throw new EntityNotFoundException('User', currentUserId);
    }

    // Delegate authorization check to domain service
    // This will throw appropriate domain exceptions if not authorized
    this.userAuthorizationService.validateCanQueryCompanyUsers(currentUser, companyId);

    // Get users from repository
    const users = await this.userRepository.findAllByCompanyId(companyId);

    // Use the mapper to convert each user to response DTO
    return users.map(user => UserMapper.toDetailResponse(user));
  }
}
