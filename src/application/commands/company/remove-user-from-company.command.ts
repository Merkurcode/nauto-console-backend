import { ICommand, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable, Inject, ForbiddenException } from '@nestjs/common';
import { UserId } from '@core/value-objects/user-id.vo';
import { User } from '@core/entities/user.entity';
import { IUserRepository } from '@core/repositories/user.repository.interface';
import { USER_REPOSITORY } from '@shared/constants/tokens';
import { EntityNotFoundException } from '@core/exceptions/domain-exceptions';
import { UserAuthorizationService } from '@core/services/user-authorization.service';

export class RemoveUserFromCompanyCommand implements ICommand {
  constructor(
    public readonly userId: UserId,
    public readonly currentUserId: UserId,
  ) {}
}

@Injectable()
@CommandHandler(RemoveUserFromCompanyCommand)
export class RemoveUserFromCompanyCommandHandler
  implements ICommandHandler<RemoveUserFromCompanyCommand>
{
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    private readonly userAuthorizationService: UserAuthorizationService,
  ) {}

  async execute(command: RemoveUserFromCompanyCommand): Promise<void> {
    const { userId, currentUserId } = command;

    // Verify current user exists
    const currentUser = await this.userRepository.findById(currentUserId.getValue());
    if (!currentUser) {
      throw new EntityNotFoundException('Current User', currentUserId.getValue());
    }

    // Verify target user exists
    const targetUser = await this.userRepository.findById(userId.getValue());
    if (!targetUser) {
      throw new EntityNotFoundException('User', userId.getValue());
    }

    // Check hierarchy: current user must have equal or higher hierarchy than target user
    if (!this.userAuthorizationService.canManageUser(currentUser, targetUser)) {
      throw new ForbiddenException(
        'Cannot remove user from company. Current user does not have sufficient hierarchy level to manage this user.',
      );
    }

    // Remove user from company
    targetUser.removeFromCompany();

    // Save the changes
    await this.userRepository.update(targetUser);
  }

}
