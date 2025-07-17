import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UserService } from '@core/services/user.service';
import { IUserDetailResponse } from '@application/dtos/responses/user.response';
import { UserMapper } from '@application/mappers/user.mapper';

export class AssignRoleCommand {
  constructor(
    public readonly userId: string,
    public readonly roleId: string,
    public readonly companyId?: string,
    public readonly assigningUserId?: string,
  ) {}
}

@CommandHandler(AssignRoleCommand)
export class AssignRoleCommandHandler
  implements ICommandHandler<AssignRoleCommand, IUserDetailResponse>
{
  constructor(private readonly userService: UserService) {}

  async execute(command: AssignRoleCommand): Promise<IUserDetailResponse> {
    const { userId, roleId, companyId, assigningUserId } = command;

    const user = await this.userService.assignRoleToUser(
      userId,
      roleId,
      companyId,
      assigningUserId,
    );

    // Use the mapper to convert to response DTO
    return UserMapper.toDetailResponse(user);
  }
}
