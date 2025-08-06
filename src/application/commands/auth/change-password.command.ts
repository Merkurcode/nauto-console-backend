import { CommandHandler, ICommandHandler, CommandBus } from '@nestjs/cqrs';
import { ChangePasswordCommand as UserChangePasswordCommand } from '@application/commands/user/change-password.command';
import { SessionService } from '@core/services/session.service';

export class ChangePasswordCommand {
  constructor(
    public readonly userId: string,
    public readonly currentPassword: string,
    public readonly newPassword: string,
    public readonly currentSessionToken: string,
  ) {}
}

@CommandHandler(ChangePasswordCommand)
export class ChangePasswordCommandHandler implements ICommandHandler<ChangePasswordCommand> {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly sessionService: SessionService,
  ) {}

  async execute(command: ChangePasswordCommand): Promise<{
    message: string;
  }> {
    const { userId, currentPassword, newPassword, currentSessionToken } = command;

    // Use existing user change password command
    await this.commandBus.execute(
      new UserChangePasswordCommand(userId, newPassword, currentPassword),
    );

    // Revoke all other sessions except the current one for security
    await this.sessionService.revokeUserSessionsExcept(userId, currentSessionToken);

    return {
      message:
        'Password changed successfully. All other sessions have been logged out for security.',
    };
  }
}
