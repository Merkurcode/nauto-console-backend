import { IQuery, IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { NotFoundException, Injectable } from '@nestjs/common';
import { UserService } from '@core/services/user.service';
import { IUserDetailResponse } from '@application/dtos/_responses/user/user.response';
import { UserMapper } from '@application/mappers/user.mapper';

export class GetUserQuery implements IQuery {
  constructor(
    public readonly userId: string,
    public readonly companyId?: string,
  ) {}
}

@Injectable()
@QueryHandler(GetUserQuery)
export class GetUserQueryHandler implements IQueryHandler<GetUserQuery> {
  constructor(private readonly userService: UserService) {}

  async execute(query: GetUserQuery): Promise<IUserDetailResponse> {
    const { userId } = query;

    const user = await this.userService.getUserById(userId);

    if (!user) {
      throw new NotFoundException(`User with ID "${userId}" not found`);
    }

    // Use the mapper to convert to response DTO
    return UserMapper.toDetailResponse(user);
  }
}
