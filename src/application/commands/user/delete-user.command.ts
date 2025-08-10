import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { UserService } from '@core/services/user.service';

export class DeleteUserCommand {
  constructor(
    public readonly targetUserId: string,
    public readonly currentUserId: string,
    public readonly companyId: string,
  ) {}
}

@Injectable()
@CommandHandler(DeleteUserCommand)
export class DeleteUserCommandHandler
  implements ICommandHandler<DeleteUserCommand, { message: string; companyId: string }>
{
  constructor(private readonly userService: UserService) {}

  async execute(command: DeleteUserCommand): Promise<{ message: string; companyId: string }> {
    const { targetUserId, currentUserId } = command;

    // Use domain service to delete user
    return await this.userService.deleteUser(targetUserId, currentUserId);
  }
}
