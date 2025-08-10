import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { UserService } from '@core/services/user.service';
import { IUserBaseResponse } from '@application/dtos/_responses/user/user.response';

export class ActivateUserCommand {
  constructor(
    public readonly targetUserId: string,
    public readonly active: boolean,
    public readonly currentUserId: string,
    public readonly companyId: string,
  ) {}
}

@Injectable()
@CommandHandler(ActivateUserCommand)
export class ActivateUserCommandHandler
  implements ICommandHandler<ActivateUserCommand, IUserBaseResponse>
{
  constructor(private readonly userService: UserService) {}

  async execute(command: ActivateUserCommand): Promise<IUserBaseResponse> {
    const { targetUserId, active, currentUserId } = command;

    // Use domain service with authorization
    const user = await this.userService.activateUserWithAuthorization(
      targetUserId,
      active,
      currentUserId,
    );

    return {
      id: user.id.getValue(),
      email: user.email.getValue(),
      firstName: user.firstName.getValue(),
      lastName: user.lastName.getValue(),
    };
  }
}
