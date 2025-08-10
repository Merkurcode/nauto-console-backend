import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UserService } from '@core/services/user.service';

export class AdminChangePasswordCommand {
  constructor(
    public readonly targetUserId: string,
    public readonly newPassword: string,
    public readonly adminUserId: string,
    public readonly adminRoles: string[],
    public readonly adminCompanyId?: string,
  ) {}
}

@CommandHandler(AdminChangePasswordCommand)
export class AdminChangePasswordCommandHandler
  implements ICommandHandler<AdminChangePasswordCommand, { success: boolean; message: string }>
{
  constructor(private readonly userService: UserService) {}

  async execute(
    command: AdminChangePasswordCommand,
  ): Promise<{ success: boolean; message: string }> {
    const { targetUserId, newPassword, adminUserId } = command;

    const updatedUser = await this.userService.adminChangeUserPassword(
      targetUserId,
      newPassword,
      adminUserId,
    );

    return {
      success: true,
      message: `Password updated successfully for user ${updatedUser.email.getValue()}`,
    };
  }
}
