import { ICommand, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { UserService } from '@core/services/user.service';
import { UserMapper } from '@application/mappers/user.mapper';
import { UserDetailResponseMapper } from '@application/mappers/user-detail-response.mapper';
import { IUserDetailResponse } from '@application/dtos/_responses/user/user-detail.response.interface';

export class CreateBotUserCommand implements ICommand {
  constructor(
    public readonly alias: string,
    public readonly companyId: string,
    public readonly password: string,
    public readonly currentUserId: string,
  ) {}
}

@CommandHandler(CreateBotUserCommand)
export class CreateBotUserCommandHandler implements ICommandHandler<CreateBotUserCommand> {
  constructor(private readonly userService: UserService) {}

  async execute(command: CreateBotUserCommand): Promise<IUserDetailResponse> {
    const { alias, companyId, password, currentUserId } = command;

    // Use domain service to create bot user
    const savedUser = await this.userService.createBotUser(
      alias,
      companyId,
      password,
      currentUserId,
    );

    const userDetailInterface = UserMapper.toDetailResponse(savedUser);

    return UserDetailResponseMapper.toUserDetailResponse(userDetailInterface);
  }
}
