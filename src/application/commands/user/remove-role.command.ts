import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UserService } from '@core/services/user.service';
import { IUserDetailResponse } from '@application/dtos/responses/user.response';
import { UserMapper } from '@application/mappers/user.mapper';

export class RemoveRoleCommand {
  constructor(
    public readonly userId: string,
    public readonly roleId: string,
    public readonly companyId?: string,
  ) {}
}

@CommandHandler(RemoveRoleCommand)
export class RemoveRoleCommandHandler
  implements ICommandHandler<RemoveRoleCommand, IUserDetailResponse>
{
  constructor(private readonly userService: UserService) {}

  async execute(command: RemoveRoleCommand): Promise<IUserDetailResponse> {
    const { userId, roleId, companyId: _companyId } = command;

    const user = await this.userService.removeRoleFromUser(userId, roleId);

    // Use the mapper to convert to response DTO
    return UserMapper.toDetailResponse(user);
  }
}
