import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { AuthService } from '@core/services/auth.service';
import { UserService } from '@core/services/user.service';
import { UserAuthorizationService } from '@core/services/user-authorization.service';
import { BusinessConfigurationService } from '@core/services/business-configuration.service';
import { IUserRepository } from '@core/repositories/user.repository.interface';
import { USER_REPOSITORY } from '@shared/constants/tokens';
import { EntityNotFoundException } from '@core/exceptions/domain-exceptions';
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
    private readonly userAuthorizationService: UserAuthorizationService,
    private readonly businessConfigService: BusinessConfigurationService,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(
    command: AdminChangePasswordCommand,
  ): Promise<{ success: boolean; message: string }> {
    const { targetUserId, newPassword, adminUserId } = command;

    // Get admin user using centralized method
    const adminUser = await this.userAuthorizationService.getCurrentUserSafely(adminUserId);

    // Find the target user
    const targetUser = await this.userRepository.findById(targetUserId);
    if (!targetUser) {
      throw new EntityNotFoundException('User', targetUserId);
    }

    // Validate authorization using domain service
    this.userAuthorizationService.canAdminChangePassword(adminUser, targetUser);

    // Hash the new password using business configuration
    const passwordConfig = this.businessConfigService.getPasswordSecurityConfig();
    const hashedPassword = await bcrypt.hash(newPassword, passwordConfig.saltRounds);

    // Update the user's password
    targetUser.changePassword(hashedPassword);
    await this.userRepository.update(targetUser);

    return {
      success: true,
      message: `Password updated successfully for user ${targetUser.email.getValue()}`,
    };
  }
}
