import { ICommand, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { IAuthRefreshTokenResponse } from '@application/dtos/_responses/user/user.response';
import { Injectable, Inject } from '@nestjs/common';
import { UserService } from '@core/services/user.service';
import { CompanyService } from '@core/services/company.service';
import { IUserRepository } from '@core/repositories/user.repository.interface';
import { REPOSITORY_TOKENS, TOKEN_PROVIDER } from '@shared/constants/tokens';
import { SessionService } from '@core/services/session.service';
import { AuthService } from '@core/services/auth.service';
import { UserBanService } from '@core/services/user-ban.service';
import { UserId } from '@core/value-objects/user-id.vo';
import { CompanyId } from '@core/value-objects/company-id.vo';
import { v4 as uuidv4 } from 'uuid';
import { ITokenProvider } from '@core/interfaces/token-provider.interface';
import {
  EntityNotFoundException,
  ForbiddenActionException,
  InvalidSessionException,
} from '@core/exceptions/domain-exceptions';
import { UserAuthorizationService } from '@core/services/user-authorization.service';

export class SwitchCompanyCommand implements ICommand {
  constructor(
    public readonly userId: UserId,
    public readonly companyId: CompanyId,
    public readonly sessionToken: string, // jti from JWT
  ) {}
}

@Injectable()
@CommandHandler(SwitchCompanyCommand)
export class SwitchCompanyCommandHandler implements ICommandHandler<SwitchCompanyCommand> {
  constructor(
    private readonly userService: UserService,
    private readonly companyService: CompanyService,
    private readonly sessionService: SessionService,
    private readonly authService: AuthService,
    private readonly userBanService: UserBanService,
    @Inject(REPOSITORY_TOKENS.USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(TOKEN_PROVIDER)
    private readonly tokenProvider: ITokenProvider,
    private readonly userAuthorizationService: UserAuthorizationService,
  ) {}

  async execute(command: SwitchCompanyCommand): Promise<IAuthRefreshTokenResponse> {
    const { userId, companyId, sessionToken } = command;

    // Get user with permissions
    const user = await this.userAuthorizationService.getCurrentUserSafely(userId.getValue());

    if (!this.userAuthorizationService.canAccessRootFeatures(user)) {
      throw new ForbiddenActionException(
        'Only Root users can switch companies',
        'switch-company',
        'company',
      );
    }

    // Check if user is banned
    this.userBanService.validateUserNotBanned(user);

    // Verify company exists
    const company = await this.companyService.getCompanyById(companyId);
    if (!company) {
      throw new EntityNotFoundException('Company', companyId.getValue());
    }

    // Get the current session using sessionToken (jti from JWT) to retrieve the refresh token
    const session = await this.sessionService.validateSessionToken(sessionToken);

    // Update user's companyId
    user.assignToCompany(companyId);
    await this.userRepository.update(user);

    // Get the refresh token from the session
    const currentRefreshToken = session.refreshToken;

    // Validate refresh token
    const token = await this.authService.validateRefreshToken(currentRefreshToken);
    if (!token) {
      throw new InvalidSessionException('Valid refresh token not found');
    }

    // Revoke current refresh token
    await this.authService.revokeRefreshToken(currentRefreshToken);

    // Generate new session and refresh tokens with updated company
    const newSessionToken = uuidv4();

    // Re-fetch user with updated company
    const { user: updatedUser, permissions: updatedPermissions } =
      await this.userService.getUserWithPermissionsForRefreshToken(userId.getValue());

    const { accessToken: newAccessToken, refreshToken: newRefreshToken } =
      await this.tokenProvider.generateTokens(updatedUser, updatedPermissions, newSessionToken);

    // Refresh the session (creates new session and revokes old one)
    await this.sessionService.refreshSession(
      userId.getValue(),
      currentRefreshToken,
      newSessionToken,
      newRefreshToken,
    );

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }
}
