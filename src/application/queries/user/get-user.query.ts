import { IQuery, IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { NotFoundException, Injectable, Inject } from '@nestjs/common';
import { IUserRepository } from '@core/repositories/user.repository.interface';
import { IUserDetailResponse } from '@application/dtos/responses/user.response';
import { UserMapper } from '@application/mappers/user.mapper';
import { USER_REPOSITORY } from '@shared/constants/tokens';

export class GetUserQuery implements IQuery {
  constructor(
    public readonly userId: string,
    public readonly companyId?: string,
  ) {}
}

@Injectable()
@QueryHandler(GetUserQuery)
export class GetUserQueryHandler implements IQueryHandler<GetUserQuery> {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(query: GetUserQuery): Promise<IUserDetailResponse> {
    const { userId, companyId: _companyId } = query;

    // For now, we'll use the basic findById until company-specific queries are implemented
    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new NotFoundException(`User with ID "${userId}" not found`);
    }

    // Use the mapper to convert to response DTO
    return UserMapper.toDetailResponse(user);
  }
}
