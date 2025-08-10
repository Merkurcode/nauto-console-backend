import { ICommand, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { VerifyOtpDto } from '@application/dtos/auth/verify-otp.dto';
import { IAuthTokenResponse } from '@application/dtos/_responses/user/user.response';
import { UnauthorizedException, Injectable, Inject } from '@nestjs/common';
import { UserMapper } from '@application/mappers/user.mapper';
import { UserService } from '@core/services/user.service';
import { AuthService } from '@core/services/auth.service';
import { SessionService } from '@core/services/session.service';
import { ITokenProvider } from '@core/interfaces/token-provider.interface';
import { TOKEN_PROVIDER } from '@shared/constants/tokens';
import { I18nService } from 'nestjs-i18n';
import { v4 as uuidv4 } from 'uuid';

export class VerifyOtpCommand implements ICommand {
  constructor(
    public readonly userId: string,
    public readonly verifyOtpDto: VerifyOtpDto,
  ) {}
}

@Injectable()
@CommandHandler(VerifyOtpCommand)
export class VerifyOtpCommandHandler implements ICommandHandler<VerifyOtpCommand> {
  constructor(
    private readonly userService: UserService,
    private readonly authService: AuthService,
    private readonly sessionService: SessionService,
    @Inject(TOKEN_PROVIDER)
    private readonly tokenProvider: ITokenProvider,
    private readonly i18n: I18nService,
  ) {}

  async execute(command: VerifyOtpCommand): Promise<IAuthTokenResponse> {
    const { userId, verifyOtpDto } = command;

    // Verify OTP
    const isOtpValid = await this.authService.verifyOtp(userId, verifyOtpDto.otp);
    if (!isOtpValid) {
      throw new UnauthorizedException('Invalid OTP');
    }

    // Get user with permissions
    const { user, permissions } =
      await this.userService.getUserWithPermissionsForRefreshToken(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Generate session token and JWT tokens
    const sessionToken = uuidv4();
    const { accessToken, refreshToken } = await this.tokenProvider.generateTokens(
      user,
      permissions,
      sessionToken,
    );

    // Register the session
    await this.sessionService.createSession(
      user.id.getValue(),
      sessionToken,
      refreshToken,
      null, // userAgent not available in OTP verification
      '?', // ipAddress not available in OTP verification
    );

    return {
      accessToken,
      refreshToken,
      user: UserMapper.toAuthResponse(user),
      message: this.i18n.t('common.auth.2fa.success'),
    };
  }
}
