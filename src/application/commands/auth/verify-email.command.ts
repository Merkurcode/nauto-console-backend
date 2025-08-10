import { ICommand, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { VerifyEmailDto } from '@application/dtos/auth/email-verification.dto';
import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { AuthService } from '@core/services/auth.service';
import { SessionService } from '@core/services/session.service';
import { UserService } from '@core/services/user.service';
import { IAuthTokenResponse } from '@application/dtos/_responses/user/user.response';
import { UserMapper } from '@application/mappers/user.mapper';
import { ITokenProvider } from '@core/interfaces/token-provider.interface';
import { TOKEN_PROVIDER } from '@shared/constants/tokens';

export class VerifyEmailCommand implements ICommand {
  constructor(public readonly dto: VerifyEmailDto) {}
}

@Injectable()
@CommandHandler(VerifyEmailCommand)
export class VerifyEmailCommandHandler
  implements ICommandHandler<VerifyEmailCommand, IAuthTokenResponse | { verified: boolean }>
{
  constructor(
    private readonly authService: AuthService,
    private readonly sessionService: SessionService,
    private readonly userService: UserService,
    @Inject(TOKEN_PROVIDER)
    private readonly tokenProvider: ITokenProvider,
  ) {}

  async execute(command: VerifyEmailCommand): Promise<IAuthTokenResponse | { verified: boolean }> {
    const { email, code } = command.dto;

    // Verify the email code
    const verified = await this.authService.verifyEmailCode(email, code);

    if (!verified) {
      return { verified: false };
    }

    // If verification succeeded, we can immediately login the user
    // 1. Find the user by email and get permissions
    const { user, permissions } = await this.userService.getUserWithPermissionsForRefreshToken(
      (await this.userService.findUserByEmail(email))?.id.getValue() || '',
    );

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // 2. Update last login
    await this.authService.updateLastLogin(user.id.getValue());

    // 3. Generate session token and JWT tokens
    const sessionToken = uuidv4();
    const { accessToken, refreshToken } = await this.tokenProvider.generateTokens(
      user,
      permissions,
      sessionToken,
    );

    // 4. Register the session
    await this.sessionService.createSession(
      user.id.getValue(),
      sessionToken,
      refreshToken,
      null, // userAgent not available in email verification
      '?', // ipAddress not available in email verification
    );

    // 5. Return tokens and user information
    return {
      accessToken,
      refreshToken,
      user: UserMapper.toAuthResponse(user),
    };
  }
}
