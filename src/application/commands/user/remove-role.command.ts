import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { UserService } from '@core/services/user.service';
import { IUserDetailResponse } from '@application/dtos/_responses/user/user.response';
import { UserMapper } from '@application/mappers/user.mapper';

export class RemoveRoleCommand {
  constructor(
    public readonly targetUserId: string,
    public readonly roleId: string,
    public readonly currentUserId: string,
    public readonly companyId: string,
  ) {}
}

@Injectable()
@CommandHandler(RemoveRoleCommand)
export class RemoveRoleCommandHandler
  implements ICommandHandler<RemoveRoleCommand, IUserDetailResponse>
{
  constructor(private readonly userService: UserService) {}

  async execute(command: RemoveRoleCommand): Promise<IUserDetailResponse> {
    const { targetUserId, roleId, currentUserId } = command;

    // Use domain service with authorization
    const user = await this.userService.removeRoleFromUserWithAuthorization(
      targetUserId,
      roleId,
      currentUserId,
    );

    // Use the mapper to convert to response DTO
    return UserMapper.toDetailResponse(user);
  }
}
