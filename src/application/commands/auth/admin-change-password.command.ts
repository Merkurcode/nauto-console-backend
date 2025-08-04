import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { AuthService } from '@core/services/auth.service';
import { UserService } from '@core/services/user.service';
import { User } from '@core/entities/user.entity';
import { IUserRepository } from '@core/repositories/user.repository.interface';
import { USER_REPOSITORY } from '@shared/constants/tokens';
import {
  EntityNotFoundException,
  ForbiddenActionException,
} from '@core/exceptions/domain-exceptions';
import { RolesEnum } from '@shared/constants/enums';
import * as bcrypt from 'bcrypt';

export class AdminChangePasswordCommand {
  constructor(
    public readonly targetUserId: string,
    public readonly newPassword: string,
    public readonly adminUserId: string,
    public readonly adminRoles: string[],
    public readonly adminCompanyId?: string,
  ) {}
}

@CommandHandler(AdminChangePasswordCommand)
export class AdminChangePasswordCommandHandler
  implements ICommandHandler<AdminChangePasswordCommand, { success: boolean; message: string }>
{
  constructor(
    private readonly authService: AuthService,
    private readonly userService: UserService,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(
    command: AdminChangePasswordCommand,
  ): Promise<{ success: boolean; message: string }> {
    const { targetUserId, newPassword, adminUserId, adminRoles, adminCompanyId } = command;

    // Find the target user
    const targetUser = await this.userRepository.findById(targetUserId);
    if (!targetUser) {
      throw new EntityNotFoundException('User', targetUserId);
    }

    // Validate authorization based on roles and target user role
    await this.validateAuthorization(
      adminRoles,
      adminCompanyId,
      targetUser.companyId?.getValue(),
      targetUser,
    );

    // Hash the new password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update the user's password
    targetUser.changePassword(hashedPassword);
    await this.userRepository.update(targetUser);

    return {
      success: true,
      message: `Password updated successfully for user ${targetUser.email.getValue()}`,
    };
  }

  private async validateAuthorization(
    adminRoles: string[],
    adminCompanyId: string | undefined,
    targetUserCompanyId: string | undefined,
    targetUser: User,
  ): Promise<void> {
    // Check target user roles for security restrictions
    const targetUserRoles = targetUser.roles.map(role => role.name.toLowerCase());

    // Check if user has ROOT role
    if (adminRoles.includes(RolesEnum.ROOT)) {
      // Root can change password of any user EXCEPT other root users
      // Root CAN change password of root_readonly users
      if (
        targetUserRoles.includes(RolesEnum.ROOT) &&
        !targetUserRoles.includes(RolesEnum.ROOT_READONLY)
      ) {
        throw new ForbiddenActionException(
          'Root users cannot change passwords of other root users for security reasons',
        );
      }
      return;
    }

    // Check if user has ADMIN role
    if (adminRoles.includes(RolesEnum.ADMIN)) {
      // Admin cannot change passwords of any root or root_readonly users
      if (
        targetUserRoles.includes(RolesEnum.ROOT) ||
        targetUserRoles.includes(RolesEnum.ROOT_READONLY)
      ) {
        throw new ForbiddenActionException(
          'Admin users cannot change passwords of root or root_readonly users',
        );
      }

      // Admin can only change password of users in the same company
      if (!adminCompanyId) {
        throw new ForbiddenActionException('Admin user must belong to a company');
      }

      if (!targetUserCompanyId) {
        throw new ForbiddenActionException('Target user must belong to a company');
      }

      if (adminCompanyId !== targetUserCompanyId) {
        throw new ForbiddenActionException(
          'Admin can only change passwords of users in the same company',
        );
      }
      return;
    }

    // If no valid role found
    throw new ForbiddenActionException('Insufficient permissions to change user passwords');
  }
}
