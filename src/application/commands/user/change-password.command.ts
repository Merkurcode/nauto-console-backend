import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UserService } from '@core/services/user.service';

export class ChangePasswordCommand {
  constructor(
    public readonly userId: string,
    public readonly newPassword: string,
    public readonly currentPassword?: string,
    public readonly companyId?: string,
  ) {}
}

@CommandHandler(ChangePasswordCommand)
export class ChangePasswordCommandHandler implements ICommandHandler<ChangePasswordCommand, void> {
  constructor(private readonly userService: UserService) {}

  async execute(command: ChangePasswordCommand): Promise<void> {
    const { userId, newPassword, currentPassword, companyId: _companyId } = command;

    await this.userService.changePassword(userId, newPassword, currentPassword);
  }
}
