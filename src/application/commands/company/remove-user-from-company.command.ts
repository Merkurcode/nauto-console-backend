import { ICommand, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable, Inject } from '@nestjs/common';
import { UserId } from '@core/value-objects/user-id.vo';
import { IUserRepository } from '@core/repositories/user.repository.interface';
import { USER_REPOSITORY } from '@shared/constants/tokens';
import { EntityNotFoundException } from '@core/exceptions/domain-exceptions';

export class RemoveUserFromCompanyCommand implements ICommand {
  constructor(public readonly userId: UserId) {}
}

@Injectable()
@CommandHandler(RemoveUserFromCompanyCommand)
export class RemoveUserFromCompanyCommandHandler
  implements ICommandHandler<RemoveUserFromCompanyCommand>
{
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(command: RemoveUserFromCompanyCommand): Promise<void> {
    const { userId } = command;

    // Verify user exists
    const user = await this.userRepository.findById(userId.getValue());
    if (!user) {
      throw new EntityNotFoundException('User', userId.getValue());
    }

    // Remove user from company
    user.removeFromCompany();

    // Save the changes
    await this.userRepository.update(user);
  }
}
