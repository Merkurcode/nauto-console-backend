import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable, Inject, ForbiddenException } from '@nestjs/common';
import { UserService } from '@core/services/user.service';
import { UserAuthorizationService } from '@core/services/user-authorization.service';
import { IUserRepository } from '@core/repositories/user.repository.interface';
import { USER_REPOSITORY } from '@shared/constants/tokens';
import { IUserBaseResponse } from '@application/dtos/responses/user.response';

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
  constructor(
    private readonly userService: UserService,
    private readonly userAuthorizationService: UserAuthorizationService,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(command: ActivateUserCommand): Promise<IUserBaseResponse> {
    const { targetUserId, active, currentUserId } = command;

    // Get current user using centralized method
    const currentUser = await this.userAuthorizationService.getCurrentUserSafely(currentUserId);

    // Get target user to get their company ID
    const targetUser = await this.userRepository.findById(targetUserId);
    if (!targetUser) {
      throw new ForbiddenException('Target user not found');
    }

    // Check authorization using domain service
    const targetUserCompanyId = targetUser.companyId?.getValue() || '';
    if (!this.userAuthorizationService.canActivateUser(currentUser, targetUserCompanyId)) {
      throw new ForbiddenException('You do not have permission to activate/deactivate this user');
    }

    let user;
    if (active) {
      user = await this.userService.activateUser(targetUserId);
    } else {
      user = await this.userService.deactivateUser(targetUserId);
    }

    return {
      id: user.id,
      email: user.email.getValue(),
      firstName: user.firstName.getValue(),
      lastName: user.lastName.getValue(),
    };
  }
}
