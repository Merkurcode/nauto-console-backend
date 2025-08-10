import { ICommand, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { AuthService } from '@core/services/auth.service';
import { IUserBaseResponse } from '@application/dtos/_responses/user/user.response';
import { UserMapper } from '@application/mappers/user.mapper';

export class Disable2FACommand implements ICommand {
  constructor(public readonly userId: string) {}
}

@Injectable()
@CommandHandler(Disable2FACommand)
export class Disable2FACommandHandler
  implements ICommandHandler<Disable2FACommand, IUserBaseResponse>
{
  constructor(private readonly authService: AuthService) {}

  async execute(command: Disable2FACommand): Promise<IUserBaseResponse> {
    const { userId } = command;

    // Disable 2FA for the user
    const user = await this.authService.disableTwoFactorAuth(userId);

    // Use the mapper to convert to response DTO
    return UserMapper.toBaseResponse(user);
  }
}
