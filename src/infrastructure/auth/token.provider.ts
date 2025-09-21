import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { v4 as uuidv4 } from 'uuid';
import { AuthService } from '@core/services/auth.service';
import { User } from '@core/entities/user.entity';
import { ILogger } from '@core/interfaces/logger.interface';
import { ITokenProvider } from '@core/interfaces/token-provider.interface';
import { LOGGER_SERVICE } from '@shared/constants/tokens';
import { IJwtPayload } from '@application/dtos/_responses/user/user.response';
//import { RolesEnum } from '@shared/constants/enums';
import { BOT_SPECIAL_PERMISSIONS } from '@shared/constants/bot-permissions';

// Work IJwtPayload with:
//  \nauto-console-backend\src\presentation\modules\auth\strategies\jwt.strategy.ts
//  \nauto-console-backend\src\presentation\guards\jwt-auth.guard.ts
@Injectable()
export class TokenProvider implements ITokenProvider {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
    @Inject(LOGGER_SERVICE)
    private readonly logger: ILogger,
  ) {
    this.logger.setContext(TokenProvider.name);
  }

  /**
   * Generate a JWT payload with user information
   */
  buildPayload(user: User, permissions: string[], sessionToken?: string): IJwtPayload {
    const payload: IJwtPayload = {
      sub: user.id.getValue(),
      email: user.email.getValue(),
      isBanned: user.isBanned(),
      bannedUntil: user.bannedUntil,
      banReason: user.banReason,
      emailVerified: user.emailVerified,
      isActive: user.isActive,
      roles: user.roles ? user.roles.map(role => role.name) : [],
      permissions: permissions || [],
      tenantId: user.getTenantId(),
      companyId: user.companyId?.getValue(),
      //jti
      //tokenId
      isBotToken: (permissions || []).includes(BOT_SPECIAL_PERMISSIONS.ALL_ACCESS), //user.roles.some(role => role.name === RolesEnum.BOT),
      //iat
      //exp
    };

    // Add session token as jti (JWT ID) claim if provided
    if (sessionToken) {
      payload['jti'] = sessionToken;
      this.logger.debug({
        message: 'Session token added to JWT payload',
        sessionToken,
        userId: user.id.getValue(),
      });
    } else {
      this.logger.debug({
        message: 'No session token provided to buildPayload',
        userId: user.id.getValue(),
      });
    }

    this.logger.debug({
      message: 'JWT payload built successfully',
      userId: user.id.getValue(),
      email: user.email.getValue(),
      rolesCount: user.roles?.length || 0,
      hasSessionToken: !!sessionToken,
    });

    return payload;
  }

  /**
   * Generate an access token
   */
  generateAccessToken(payload: IJwtPayload): string {
    return this.jwtService.sign(payload, {
      secret: this.configService.get('jwt.secret'),
      expiresIn: this.configService.get('jwt.accessExpiration'),
      algorithm: this.configService.get('jwt.algorithm', 'HS512'),
    });
  }

  /**
   * Generate a refresh token and store it
   */
  async generateRefreshToken(userId: string): Promise<string> {
    const refreshToken = uuidv4();
    await this.authService.createRefreshToken(userId, refreshToken);

    return refreshToken;
  }

  /**
   * Generate both access and refresh tokens for a user
   */
  async generateTokens(user: User, permissions: string[], sessionToken?: string) {
    const payload = this.buildPayload(user, permissions, sessionToken);
    const accessToken = this.generateAccessToken(payload);
    const refreshToken = await this.generateRefreshToken(user.id.getValue());

    return {
      accessToken,
      refreshToken,
      sessionToken: sessionToken || uuidv4(), // Return the session token
    };
  }
}
