import { ICommand, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RefreshTokenDto } from '@application/dtos/auth/refresh-token.dto';
import { IAuthRefreshTokenResponse } from '@application/dtos/_responses/user/user.response';
import { UnauthorizedException, Injectable, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UserService } from '@core/services/user.service';
import { AuthService } from '@core/services/auth.service';
import { SessionService } from '@core/services/session.service';
import { UserBanService } from '@core/services/user-ban.service';
import { RolesEnum } from '@shared/constants/enums';
import { v4 as uuidv4 } from 'uuid';

export class RefreshTokenCommand implements ICommand {
  constructor(public readonly refreshTokenDto: RefreshTokenDto) {}
}

@Injectable()
@CommandHandler(RefreshTokenCommand)
export class RefreshTokenCommandHandler implements ICommandHandler<RefreshTokenCommand> {
  constructor(
    private readonly userService: UserService,
    private readonly authService: AuthService,
    private readonly sessionService: SessionService,
    private readonly userBanService: UserBanService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async execute(command: RefreshTokenCommand): Promise<IAuthRefreshTokenResponse> {
    const { refreshToken } = command.refreshTokenDto;

    // Validate refresh token
    const token = await this.authService.validateRefreshToken(refreshToken);
    if (!token) {
      throw new UnauthorizedException();
    }

    // Get user with permissions using service
    const { user, permissions } = await this.userService.getUserWithPermissionsForRefreshToken(
      token.userId.getValue(),
    );

    // Check if user is BOT - BOTs cannot use refresh tokens
    const isBotUser = user.roles.some(role => role.name === RolesEnum.BOT);
    if (isBotUser) {
      throw new ForbiddenException('BOT users cannot use refresh token functionality');
    }

    // Check if user is banned
    this.userBanService.validateUserNotBanned(user);

    // Validate session exists and is active
    await this.sessionService.validateRefreshToken(refreshToken);

    // Revoke current refresh token
    await this.authService.revokeRefreshToken(refreshToken);

    // Generate new session and refresh tokens
    const newSessionToken = uuidv4();
    const newRefreshToken = uuidv4();

    // Refresh the session (creates new session and revokes old one)
    await this.sessionService.refreshSession(
      user.id.getValue(),
      refreshToken,
      newSessionToken,
      newRefreshToken,
    );

    // Generate new JWT with session token
    const payload = {
      sub: user.id.getValue(),
      email: user.email.getValue(),
      emailVerified: user.emailVerified,
      roles: user.roles.map(role => role.name),
      permissions,
      tenantId: user.getTenantId(),
      jti: newSessionToken, // Include session token as JWT ID
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get('jwt.secret'),
      expiresIn: this.configService.get('jwt.accessExpiration'),
      algorithm: this.configService.get('jwt.algorithm', 'HS512'),
    });

    // Create new refresh token entry
    await this.authService.createRefreshToken(user.id.getValue(), newRefreshToken);

    return {
      accessToken,
      refreshToken: newRefreshToken,
    };
  }
}
