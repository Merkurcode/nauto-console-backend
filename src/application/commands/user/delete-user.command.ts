import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable, Inject, ForbiddenException } from '@nestjs/common';
import { IUserRepository } from '@core/repositories/user.repository.interface';
import { UserAuthorizationService } from '@core/services/user-authorization.service';
import { USER_REPOSITORY } from '@shared/constants/tokens';

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
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    private readonly userAuthorizationService: UserAuthorizationService,
  ) {}

  async execute(command: DeleteUserCommand): Promise<{ message: string; companyId: string }> {
    const { targetUserId, currentUserId, companyId } = command;

    // Get current user for authorization check
    const currentUser = await this.userRepository.findById(currentUserId);
    if (!currentUser) {
      throw new ForbiddenException('Current user not found');
    }

    // Get target user
    const targetUser = await this.userRepository.findById(targetUserId);
    if (!targetUser) {
      throw new ForbiddenException('Target user not found');
    }

    // Check authorization using domain service
    if (!this.userAuthorizationService.canDeleteUser(currentUser, targetUser)) {
      throw new ForbiddenException('You do not have permission to delete this user');
    }

    // Delete user using repository method
    const deleteResult = await this.userRepository.delete(targetUserId);

    if (!deleteResult) {
      throw new Error('Failed to delete user');
    }

    return { message: 'User deleted successfully', companyId };
  }
}
