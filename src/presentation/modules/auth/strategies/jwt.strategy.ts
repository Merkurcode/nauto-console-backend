import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { IUserRepository } from '@core/repositories/user.repository.interface';
import { IJwtPayload } from '@application/dtos/responses/user.response';
import { ILogger } from '@core/interfaces/logger.interface';
import { LOGGER_SERVICE } from '@shared/constants/tokens';

// JWT-specific token (defined locally to avoid circular dependencies)
const JWT_USER_REPOSITORY = 'JWT_USER_REPOSITORY';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    @Inject(JWT_USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(LOGGER_SERVICE)
    private readonly logger: ILogger,
  ) {
    logger.setContext(JwtStrategy.name);
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('jwt.secret') || 'fallback_secret',
    });
  }

  async validate(payload: IJwtPayload): Promise<IJwtPayload> {
    this.logger.debug({
      message: 'JWT Strategy validating payload',
      userId: payload.sub,
      email: payload.email,
      sessionToken: payload.jti,
      roles: payload.roles,
    });

    // Check if the user still exists
    const user = await this.userRepository.findById(payload.sub);

    // If a user is not found or not active, throw an UnauthorizedException
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User no longer active or not found');
    }

    // Return the payload with roles, permissions, tenant info, and session token which will be injected into the request object
    const result = {
      sub: payload.sub,
      email: payload.email,
      isActive: user.isActive, // Include isActive from the database user
      roles: payload.roles || [],
      permissions: payload.permissions || [],
      tenantId: payload.tenantId,
      companyId: payload.companyId,
      jti: payload.jti, // Include session token from JWT
    };

    this.logger.debug({
      message: 'JWT Strategy validation successful',
      userId: result.sub,
      email: result.email,
      rolesCount: result.roles?.length || 0,
      permissionsCount: result.permissions?.length || 0,
      tenantId: result.tenantId,
    });

    return result;
  }
}
