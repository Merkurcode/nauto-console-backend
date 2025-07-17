import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UserService } from '@core/services/user.service';
import { IUserBaseResponse } from '@application/dtos/responses/user.response';

export class ActivateUserCommand {
  constructor(
    public readonly userId: string,
    public readonly active: boolean,
    public readonly companyId?: string,
  ) {}
}

@CommandHandler(ActivateUserCommand)
export class ActivateUserCommandHandler
  implements ICommandHandler<ActivateUserCommand, IUserBaseResponse>
{
  constructor(private readonly userService: UserService) {}

  async execute(command: ActivateUserCommand): Promise<IUserBaseResponse> {
    const { userId, active, companyId: _companyId } = command;

    let user;
    if (active) {
      user = await this.userService.activateUser(userId);
    } else {
      user = await this.userService.deactivateUser(userId);
    }

    return {
      id: user.id,
      email: user.email.getValue(),
      firstName: user.firstName.getValue(),
      lastName: user.lastName.getValue(),
    };
  }
}
