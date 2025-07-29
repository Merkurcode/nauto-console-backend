import { ICommand, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { VerifyOtpDto } from '@application/dtos/auth/verify-otp.dto';
import { IAuthTokenResponse } from '@application/dtos/responses/user.response';
import { UnauthorizedException, Injectable, Inject } from '@nestjs/common';
import { UserMapper } from '@application/mappers/user.mapper';
import { IUserRepository } from '@core/repositories/user.repository.interface';
import { IRoleRepository } from '@core/repositories/role.repository.interface';
import { AuthService } from '@core/services/auth.service';
import { SessionService } from '@core/services/session.service';
import { TokenProvider } from '@presentation/modules/auth/providers/token.provider';
import { I18nService } from 'nestjs-i18n';
import { v4 as uuidv4 } from 'uuid';
import { USER_REPOSITORY, ROLE_REPOSITORY } from '@shared/constants/tokens';

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
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(ROLE_REPOSITORY)
    private readonly roleRepository: IRoleRepository,
    private readonly authService: AuthService,
    private readonly sessionService: SessionService,
    private readonly tokenProvider: TokenProvider,
    private readonly i18n: I18nService,
  ) {}

  async execute(command: VerifyOtpCommand): Promise<IAuthTokenResponse> {
    const { userId, verifyOtpDto } = command;

    // Verify OTP
    const isOtpValid = await this.authService.verifyOtp(userId, verifyOtpDto.otp);
    if (!isOtpValid) {
      throw new UnauthorizedException('Invalid OTP');
    }

    // Get user
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Collect all permissions from all user roles
    const userPermissions = new Set<string>();
    for (const role of user.roles) {
      const roleWithPermissions = await this.roleRepository.findById(role.id.getValue());
      if (roleWithPermissions && roleWithPermissions.permissions) {
        roleWithPermissions.permissions.forEach(permission => {
          userPermissions.add(permission.getStringName());
        });
      }
    }

    // Generate session token and JWT tokens
    const sessionToken = uuidv4();
    const { accessToken, refreshToken } = await this.tokenProvider.generateTokens(
      user,
      Array.from(userPermissions),
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
