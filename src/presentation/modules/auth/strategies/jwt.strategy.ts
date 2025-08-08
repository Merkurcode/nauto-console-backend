import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { IUserRepository } from '@core/repositories/user.repository.interface';
import { IJwtPayload } from '@application/dtos/responses/user.response';
import { ILogger } from '@core/interfaces/logger.interface';
import { LOGGER_SERVICE } from '@shared/constants/tokens';
import { SessionService } from '@core/services/session.service';
import { BotSessionValidationService } from '@core/services/bot-session-validation.service';
import { BOT_SPECIAL_PERMISSIONS } from '@shared/constants/bot-permissions';

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
    private readonly sessionService: SessionService,
    private readonly botSessionValidationService: BotSessionValidationService,
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
      message: 'JWT Strategy validating payload with enhanced security',
      userId: payload.sub,
      email: payload.email
        ? `${payload.email.substring(0, 3)}***@${payload.email.split('@')[1]}`
        : 'undefined',
      sessionTokenPrefix: payload.jti ? payload.jti.substring(0, 8) + '***' : 'undefined',
      rolesCount: payload.roles?.length || 0,
      hasPermissions: Array.isArray(payload.permissions) && payload.permissions.length > 0,
      isBotToken, // Log si es token BOT
    });

    let user;
    let userFound = false;
    let isUserActive = false;

    try {
      // Security: Always perform user lookup to maintain consistent timing
      user = await this.userRepository.findById(payload.sub);

      if (user) {
        userFound = true;
        isUserActive = user.isActive;
      }
    } catch (error) {
      // Security: Log error but maintain consistent timing
      this.logger.error({
        message: 'User lookup failed during JWT validation',
        userId: payload.sub,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Security: Check conditions after user lookup
    if (!userFound || !isUserActive) {
      throw new UnauthorizedException('User no longer active or not found');
    }

    // Enhanced Session Validation - validate that the session exists and is active
    // Skip session validation for BOT tokens
    if (payload.jti && !isBotToken) {
      try {
        await this.sessionService.validateSessionToken(payload.jti);

        // Update session activity and extend if configured
        await this.sessionService.updateSessionActivity(payload.jti);

        this.logger.debug({
          message: 'Session validated and activity updated',
          userId: payload.sub,
          sessionToken: payload.jti?.substring(0, 10) + '...',
        });
      } catch (error) {
        this.logger.warn({
          message: 'Session token validation failed',
          userId: payload.sub,
          sessionToken: payload.jti?.substring(0, 10) + '...',
          error: error instanceof Error ? error.message : String(error),
        });
        throw new UnauthorizedException('Session is invalid or expired');
      }
    } else if (isBotToken && payload.jti && payload.tokenId) {
      // BOT tokens have their own session validation mechanism
      try {
        await this.botSessionValidationService.validateBotSession(payload.jti, payload.tokenId);

        this.logger.debug({
          message: 'BOT session validated successfully',
          userId: payload.sub,
          tokenId: payload.tokenId?.substring(0, 8) + '***',
          sessionTokenId: payload.jti?.substring(0, 8) + '***',
        });
      } catch (error) {
        this.logger.warn({
          message: 'BOT session validation failed',
          userId: payload.sub,
          tokenId: payload.tokenId?.substring(0, 8) + '***',
          sessionTokenId: payload.jti?.substring(0, 8) + '***',
          error: error instanceof Error ? error.message : String(error),
        });
        throw new UnauthorizedException('BOT session is invalid or token has been revoked');
      }
    }

    // Security: Consistent timing delay to prevent timing attacks
    const validationDuration = Date.now() - validationStartTime;
    const minValidationTime = 50; // Minimum 50ms validation time

    if (validationDuration < minValidationTime) {
      const delayTime = minValidationTime - validationDuration;
      await new Promise(resolve => setTimeout(resolve, delayTime));
    }

    // Return the payload with all security validations passed
    const result = {
      sub: payload.sub,
      email: payload.email,
      isActive: user.isActive,
      roles: payload.roles || [],
      permissions: payload.permissions || [],
      tenantId: payload.tenantId,
      companyId: payload.companyId,
      jti: payload.jti,
    };

    // Security: Sanitize sensitive information in success logs
    this.logger.debug({
      message: 'Enhanced JWT validation successful',
      userId: result.sub,
      email: result.email
        ? `${result.email.substring(0, 3)}***@${result.email.split('@')[1]}`
        : 'undefined',
      rolesCount: result.roles?.length || 0,
      permissionsCount: result.permissions?.length || 0,
      hasTenant: !!result.tenantId,
      hasCompany: !!result.companyId,
      totalValidationTime: Date.now() - validationStartTime,
    });

    return result;
  }
}
