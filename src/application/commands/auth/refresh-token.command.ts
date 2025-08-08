import { ICommand, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { RefreshTokenDto } from '@application/dtos/auth/refresh-token.dto';
import { IAuthRefreshTokenResponse } from '@application/dtos/responses/user.response';
import { UnauthorizedException, Injectable, Inject, ForbiddenException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { IUserRepository } from '@core/repositories/user.repository.interface';
import { IRoleRepository } from '@core/repositories/role.repository.interface';
import { AuthService } from '@core/services/auth.service';
import { SessionService } from '@core/services/session.service';
import { UserBanService } from '@core/services/user-ban.service';
import { RolesEnum } from '@shared/constants/enums';
import { v4 as uuidv4 } from 'uuid';
import { USER_REPOSITORY, ROLE_REPOSITORY } from '@shared/constants/tokens';

export class RefreshTokenCommand implements ICommand {
  constructor(public readonly refreshTokenDto: RefreshTokenDto) {}
}

@Injectable()
@CommandHandler(RefreshTokenCommand)
export class RefreshTokenCommandHandler implements ICommandHandler<RefreshTokenCommand> {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(ROLE_REPOSITORY)
    private readonly roleRepository: IRoleRepository,
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

    // Get user
    const user = await this.userRepository.findById(token.userId.getValue());
    if (!user) {
      throw new UnauthorizedException();
    }

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

    // Generate new session and refresh tokens
    const newSessionToken = uuidv4();
    const newRefreshToken = uuidv4();

    // Refresh the session (creates new session and revokes old one)
    await this.sessionService.refreshSession(refreshToken, newSessionToken, newRefreshToken);

    // Generate new JWT with session token
    const payload = {
      sub: user.id.getValue(),
      email: user.email.getValue(),
      emailVerified: user.emailVerified,
      roles: user.roles.map(role => role.name),
      permissions: Array.from(userPermissions),
      tenantId: user.getTenantId(),
      jti: newSessionToken, // Include session token as JWT ID
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get('jwt.secret'),
      expiresIn: this.configService.get('jwt.accessExpiration'),
      algorithm: this.configService.get('JWT_ALGORITHM', 'HS512'),
    });

    // Create new refresh token entry
    await this.authService.createRefreshToken(user.id.getValue(), newRefreshToken);

    return {
      accessToken,
      refreshToken: newRefreshToken,
    };
  }
}
