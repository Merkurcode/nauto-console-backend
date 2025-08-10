import { Injectable, Inject } from '@nestjs/common';
import { User } from '@core/entities/user.entity';
import { IUserRepository } from '@core/repositories/user.repository.interface';
import { UserBannedException } from '@core/exceptions/domain-exceptions';
import { USER_REPOSITORY, LOGGER_SERVICE } from '@shared/constants/tokens';
import { ILogger } from '@core/interfaces/logger.interface';

@Injectable()
export class UserBanService {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(LOGGER_SERVICE) private readonly logger: ILogger,
  ) {
    this.logger.setContext(UserBanService.name);
  }

  /**
   * Validates if a user is currently banned
   * @param user The user to validate
   * @throws UserBannedException if user is banned
   */
  validateUserNotBanned(user: User): void {
    if (user.isBanned()) {
      this.logger.warn({
        message: 'Access denied - user is banned',
        userId: user.id.getValue(),
        bannedUntil: user.bannedUntil,
        banReason: user.banReason,
      });

      throw new UserBannedException(user.bannedUntil!, user.banReason!);
    }
  }

  /**
   * Validates if a user is currently banned by user ID
   * @param userId The user ID to validate
   * @throws UserBannedException if user is banned
   */
  async validateUserNotBannedById(userId: string): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      // If user doesn't exist, we don't need to check ban status
      return;
    }

    this.validateUserNotBanned(user);
  }

  /**
   * Bans a user until a specific date with a reason
   * @param userId The user ID to ban
   * @param bannedUntil The date until which the user is banned
   * @param banReason The reason for the ban
   */
  async banUser(userId: string, bannedUntil: Date, banReason: string): Promise<User> {
    this.logger.log({
      message: 'Banning user',
      userId,
      bannedUntil,
      banReason,
    });

    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }

    user.banUser(bannedUntil, banReason);
    const updatedUser = await this.userRepository.update(user);

    // User banned successfully

    this.logger.log({
      message: 'User banned successfully',
      userId,
      bannedUntil,
      banReason,
    });

    return updatedUser;
  }

  /**
   * Unbans a user
   * @param userId The user ID to unban
   */
  async unbanUser(userId: string): Promise<User> {
    this.logger.log({
      message: 'Unbanning user',
      userId,
    });

    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error(`User with ID ${userId} not found`);
    }

    user.unbanUser();
    const updatedUser = await this.userRepository.update(user);

    // User unbanned successfully

    this.logger.log({
      message: 'User unbanned successfully',
      userId,
    });

    return updatedUser;
  }

  /**
   * Checks if a user is currently banned
   * @param userId The user ID to check
   * @returns boolean indicating if user is banned
   */
  async isUserBanned(userId: string): Promise<boolean> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      return false;
    }

    return user.isBanned();
  }

  /**
   * Gets ban information for a user
   * @param userId The user ID to get ban info for
   * @returns Ban information or null if not banned
   */
  async getUserBanInfo(userId: string): Promise<{
    isBanned: boolean;
    bannedUntil?: Date;
    banReason?: string;
  } | null> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      return null;
    }

    return {
      isBanned: user.isBanned(),
      bannedUntil: user.bannedUntil,
      banReason: user.banReason,
    };
  }
}
