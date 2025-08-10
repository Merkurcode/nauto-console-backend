import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { IUserRepository } from '@core/repositories/user.repository.interface';
import { IJwtPayload } from '@application/dtos/responses/user.response';
import { ILogger } from '@core/interfaces/logger.interface';
import { LOGGER_SERVICE } from '@shared/constants/tokens';
import { BOT_SPECIAL_PERMISSIONS } from '@shared/constants/bot-permissions';
import { User } from '@core/entities/user.entity';

// JWT-specific token (defined locally to avoid circular dependencies)
const JWT_USER_REPOSITORY = 'JWT_USER_REPOSITORY';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    @Inject(JWT_USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(LOGGER_SERVICE)
    private readonly logger: ILogger,
  ) {
    logger.setContext(JwtStrategy.name);
    // Security: Validate JWT secret is properly configured - no fallback allowed
    const jwtSecret = configService.get<string>('jwt.secret');
    if (!jwtSecret) {
      logger.error({
        message: 'CRITICAL: JWT_SECRET environment variable is not configured',
        action: 'APPLICATION_STARTUP_FAILED',
        severity: 'CRITICAL',
      });
      throw new Error('JWT_SECRET environment variable is required for secure authentication');
    }

    // Security: Validate JWT secret strength
    if (jwtSecret.length < 32) {
      logger.error({
        message: 'CRITICAL: JWT_SECRET is too weak - must be at least 32 characters',
        currentLength: jwtSecret.length,
        minimumLength: 32,
        severity: 'CRITICAL',
      });
      throw new Error('JWT_SECRET must be at least 32 characters long for adequate security');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: true, // Permitir tokens sin expiración (BOT tokens)
      secretOrKey: jwtSecret,
    });
  }

  async validate(payload: IJwtPayload): Promise<IJwtPayload> {
    const validationStartTime = Date.now();

    // Verificar si es un token BOT
    const isBotToken = payload.permissions?.includes(BOT_SPECIAL_PERMISSIONS.ALL_ACCESS);

    // Security: Validar expiración manualmente solo para tokens NO-BOT
    if (!isBotToken && payload.exp) {
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp < now) {
        throw new UnauthorizedException('Token has expired');
      }
    }

    // Security: Sanitize sensitive information in debug logs
    this.logger.debug({
      message: 'JWT Strategy validating payload',
      userId: payload.sub,
      email: payload.email
        ? `${payload.email.substring(0, 3)}***@${payload.email.split('@')[1]}`
        : 'undefined',
      sessionTokenPrefix: payload.jti ? payload.jti.substring(0, 8) + '***' : 'undefined',
      rolesCount: payload.roles?.length || 0,
      hasPermissions: Array.isArray(payload.permissions) && payload.permissions.length > 0,
      isBotToken,
    });

    // ONLY validate user exists and is active - leave other validations to JwtAuthGuard
    let user: User;
    try {
      user = await this.userRepository.findById(payload.sub);

      if (!user || !user.isActive) {
        throw new UnauthorizedException('User no longer active or not found');
      }
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      this.logger.error({
        message: 'User lookup failed during JWT validation',
        userId: payload.sub,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new UnauthorizedException('User validation failed');
    }

    // Return enriched payload - session validation will be done in JwtAuthGuard
    const result: IJwtPayload = {
      sub: payload.sub,
      email: payload.email,
      isBanned: user.isBanned(),
      bannedUntil: user.bannedUntil,
      banReason: user.banReason,
      emailVerified: payload.emailVerified,
      isActive: user.isActive,
      roles: payload.roles || [],
      permissions: payload.permissions || [],
      tenantId: payload.tenantId,
      companyId: payload.companyId,
      jti: payload.jti,
      tokenId: payload.tokenId, // For BOT tokens
      iat: payload.iat,
      exp: payload.exp,
      isBotToken, // Pass this flag forward
    };

    // Security: Consistent timing delay to prevent timing attacks
    /*const validationDuration = Date.now() - validationStartTime;
    const minValidationTime = 50; // Minimum 50ms validation time

    if (validationDuration < minValidationTime) {
      const delayTime = minValidationTime - validationDuration;
      await new Promise(resolve => setTimeout(resolve, delayTime));
    }*/

    this.logger.debug({
      message: 'JWT Strategy validation completed',
      userId: result.sub,
      totalValidationTime: Date.now() - validationStartTime,
    });

    return result;
  }
}
