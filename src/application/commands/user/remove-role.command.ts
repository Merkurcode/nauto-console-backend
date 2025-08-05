import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable, Inject, ForbiddenException } from '@nestjs/common';
import { UserService } from '@core/services/user.service';
import { UserAuthorizationService } from '@core/services/user-authorization.service';
import { IUserRepository } from '@core/repositories/user.repository.interface';
import { IRoleRepository } from '@core/repositories/role.repository.interface';
import { USER_REPOSITORY, ROLE_REPOSITORY } from '@shared/constants/tokens';
import { IUserDetailResponse } from '@application/dtos/responses/user.response';
import { UserMapper } from '@application/mappers/user.mapper';

export class RemoveRoleCommand {
  constructor(
    public readonly targetUserId: string,
    public readonly roleId: string,
    public readonly currentUserId: string,
    public readonly companyId: string,
  ) {}
}

@Injectable()
@CommandHandler(RemoveRoleCommand)
export class RemoveRoleCommandHandler
  implements ICommandHandler<RemoveRoleCommand, IUserDetailResponse>
{
  constructor(
    private readonly userService: UserService,
    private readonly userAuthorizationService: UserAuthorizationService,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(ROLE_REPOSITORY)
    private readonly roleRepository: IRoleRepository,
  ) {}

  async execute(command: RemoveRoleCommand): Promise<IUserDetailResponse> {
    const { targetUserId, roleId, currentUserId } = command;

    // Get current user using centralized method
    const currentUser = await this.userAuthorizationService.getCurrentUserSafely(currentUserId);

    // Get target user
    const targetUser = await this.userRepository.findById(targetUserId);
    if (!targetUser) {
      throw new ForbiddenException('Target user not found');
    }

    // Get role to be removed
    const role = await this.roleRepository.findById(roleId);
    if (!role) {
      throw new ForbiddenException('Role not found');
    }

    // Check authorization using domain service
    if (!this.userAuthorizationService.canRemoveRoleFromUser(currentUser, targetUser, role)) {
      throw new ForbiddenException('You do not have permission to remove this role from this user');
    }

    const user = await this.userService.removeRoleFromUser(targetUserId, roleId);

    // Use the mapper to convert to response DTO
    return UserMapper.toDetailResponse(user);
  }
}
