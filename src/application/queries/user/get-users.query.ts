import { IQuery, IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Injectable, Inject } from '@nestjs/common';
import { IUserRepository } from '@core/repositories/user.repository.interface';
import { IUserDetailResponse } from '@application/dtos/responses/user.response';
import { UserMapper } from '@application/mappers/user.mapper';
import { USER_REPOSITORY } from '@shared/constants/tokens';

export class GetUsersQuery implements IQuery {
  constructor(public readonly companyId?: string) {}
}

@Injectable()
@QueryHandler(GetUsersQuery)
export class GetUsersQueryHandler implements IQueryHandler<GetUsersQuery> {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(query: GetUsersQuery): Promise<IUserDetailResponse[]> {
    const { companyId: _companyId } = query;

    const users = await this.userRepository.findAllByCompanyId(_companyId);

    // Use the mapper to convert each user to response DTO
    return users.map(user => UserMapper.toDetailResponse(user));
  }
}
