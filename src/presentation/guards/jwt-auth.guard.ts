import {
  Injectable,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { JwtService } from '@nestjs/jwt';
import { IS_PUBLIC_KEY } from '@shared/decorators/public.decorator';
import { LIGHTWEIGHT_AUTH_KEY } from '@shared/decorators/lightweight-auth.decorator';
import { BOT_ACCESS_KEY } from '@shared/decorators/bot-access.decorator';
import { BOT_ONLY_KEY, NO_BOTS_KEY } from '@shared/decorators/bot-restrictions.decorator';
import { SKIP_TENANT_KEY } from '@shared/decorators/skip-tenant.decorator';
import { UserBanService } from '@core/services/user-ban.service';
import { SessionService } from '@core/services/session.service';
import { BotSessionValidationService } from '@core/services/bot-session-validation.service';
import { TenantResolverService } from '@core/services/tenant-resolver.service';
import { UserAuthorizationService } from '@core/services/user-authorization.service';
import { RolesEnum } from '@shared/constants/enums';
import { IJwtPayload } from '@application/dtos/_responses/user/user.response';
import { ILogger } from '@core/interfaces/logger.interface';
import { LOGGER_SERVICE } from '@shared/constants/tokens';
import { UserBannedException } from '@core/exceptions/domain-exceptions';
import { Company } from '@core/entities/company.entity';
import { ConfigService } from '@nestjs/config';

// UUID v4 validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Work IJwtPayload with:
// \nauto-console-backend\src\presentation\modules\auth\strategies\jwt.strategy.ts
// \nauto-console-backend\src\infrastructure\auth\token.provider.ts
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly userBanService: UserBanService,
    private readonly sessionService: SessionService,
    private readonly botSessionValidationService: BotSessionValidationService,
    private readonly tenantResolverService: TenantResolverService,
    private readonly userAuthorizationService: UserAuthorizationService,
    @Inject(LOGGER_SERVICE) private readonly logger: ILogger,
    private readonly configService: ConfigService,
  ) {
    super();
    this.logger.setContext(JwtAuthGuard.name);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const validateTenant = this.configService.get<string>('security.validateTenantHost');

    const request = context.switchToHttp().getRequest();

    // Check if the route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    // Check if the route is marked for lightweight authentication
    const isLightweight = this.reflector.getAllAndOverride<boolean>(LIGHTWEIGHT_AUTH_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isLightweight) {
      // For lightweight auth, do minimal JWT validation without heavy database queries
      const authorization = request.headers.authorization;
      if (!authorization) {
        throw new UnauthorizedException('Authorization header is missing');
      }

      try {
        // Extract and verify token manually for lightweight endpoints
        // SECURITY: Validate Bearer prefix properly
        if (!authorization.startsWith('Bearer ')) {
          throw new UnauthorizedException('Invalid authorization format');
        }
        const token = authorization.substring(7).trim();
        const verified = this.jwtService.verify(token) as IJwtPayload;

        // Set user in request for @CurrentUser() decorator
        request.user = verified;

        this.logger.debug({
          message: 'Lightweight auth completed',
          userId: verified.sub,
          endpoint: request.url,
        });

        return true;
      } catch (jwtError) {
        this.logger.warn({
          message: 'Lightweight auth failed - invalid JWT',
          error: jwtError instanceof Error ? jwtError.message : String(jwtError),
          endpoint: request.url,
        });
        throw new UnauthorizedException('Invalid token');
      }
    }

    // Apply JWT authentication
    const canActivate = await super.canActivate(context);
    if (!canActivate) {
      return false;
    }

    const authorization = request.headers.authorization;
    if (!authorization) {
      throw new UnauthorizedException('Authorization header is missing');
    }

    let verified: { jti?: string; [key: string]: unknown };
    try {
      // Extract the token from the Authorization header
      // SECURITY: Validate Bearer prefix properly
      if (!authorization.startsWith('Bearer ')) {
        throw new UnauthorizedException('Invalid authorization format');
      }
      const token = authorization.substring(7).trim();
      verified = this.jwtService.verify(token) as { jti?: string; [key: string]: unknown };
    } catch (jwtError) {
      this.logger.warn({
        message: 'Invalid JWT signature in session guard',
        error: jwtError instanceof Error ? jwtError.message : String(jwtError),
      });
      throw new UnauthorizedException('Invalid token or expired session');
    }

    if (!verified || !verified.jti) {
      this.logger.warn({ message: 'JWT token missing jti claim' });
      throw new UnauthorizedException('Invalid token or expired session');
    }

    const user: IJwtPayload = request.user;

    // If no user after JWT validation, reject
    if (!user) {
      throw new UnauthorizedException('Invalid token or expired session');
    }

    if (user.isBanned) {
      this.logger.warn({
        message: 'Access denied due to user ban',
        userId: user.sub,
        bannedUntil: user.bannedUntil,
        banReason: user.banReason,
      });
      throw new UserBannedException(user.bannedUntil!, user.banReason!);
    }

    // Check if this is a BOT token
    const isBotUser = user.roles?.some(role => role === RolesEnum.BOT);

    // 1. User Ban Validation (skip for BOT tokens as they don't have ban status)
    if (!user.isBotToken) {
      try {
        await this.userBanService.validateUserNotBannedById(user.sub);
      } catch (error) {
        this.logger.warn({
          message: 'Access denied due to user ban',
          userId: user.sub,
          error: error.message,
        });
        throw error;
      }
    }

    // 2. Session Validation (different for BOT vs regular tokens)
    if (verified.jti) {
      try {
        if (user.isBotToken && user.tokenId) {
          // BOT session validation
          await this.botSessionValidationService.validateBotSession(verified.jti, user.tokenId);

          this.logger.debug({
            message: 'BOT session validated in guard',
            userId: user.sub,
            tokenId: user.tokenId?.substring(0, 8) + '***',
            sessionTokenId: verified.jti?.substring(0, 8) + '***',
          });
        } else if (!user.isBotToken) {
          // Regular session validation
          await this.sessionService.validateSessionToken(verified.jti);
          await this.sessionService.updateSessionActivity(verified.jti);

          this.logger.debug({
            message: 'Session validated and activity updated in guard',
            userId: user.sub,
            sessionToken: verified.jti?.substring(0, 10) + '...',
          });
        }
      } catch (error) {
        this.logger.warn({
          message: user.isBotToken ? 'BOT session validation failed' : 'Session validation failed',
          userId: user.sub,
          error: error instanceof Error ? error.message : String(error),
        });
        throw new UnauthorizedException(
          user.isBotToken
            ? 'BOT session is invalid or token has been revoked'
            : 'Session is invalid or expired',
        );
      }
    }

    // 3. BOT Optimization

    if (isBotUser) {
      const isBotAccessible = this.reflector.get<boolean>(BOT_ACCESS_KEY, context.getHandler());

      if (isBotAccessible) {
        request.isBotRequest = true;
        request.skipThrottling = true;

        this.logger.debug({
          message: 'BOT access to endpoint',
          method: request.method,
          path: request.url,
        });
      }
    }

    // 4. BOT Restrictions
    const botOnly =
      this.reflector.get<boolean>(BOT_ONLY_KEY, context.getHandler()) ||
      this.reflector.get<boolean>(BOT_ONLY_KEY, context.getClass());

    const noBots =
      this.reflector.get<boolean>(NO_BOTS_KEY, context.getHandler()) ||
      this.reflector.get<boolean>(NO_BOTS_KEY, context.getClass());

    if (botOnly && noBots) {
      this.logger.warn({
        message: 'Conflicting BOT decorators on endpoint',
        method: request.method,
        path: request.url,
      });
      throw new ForbiddenException('Conflicting BOT access configuration');
    }

    if (botOnly && !isBotUser) {
      this.logger.warn({
        message: 'Non-BOT user attempted to access BOT-only endpoint',
        userId: user.sub,
        email: user.email,
        roles: user.roles,
        method: request.method,
        path: request.url,
      });
      throw new ForbiddenException('This endpoint is restricted to BOT users only');
    }

    if (noBots && isBotUser) {
      this.logger.warn({
        message: 'BOT user attempted to access forbidden endpoint',
        userId: user.sub,
        email: user.email,
        roles: user.roles,
        method: request.method,
        path: request.url,
      });
      throw new ForbiddenException('BOT users cannot access this endpoint');
    }

    // 5. Tenant Isolation
    const skipTenant =
      this.reflector.get<boolean>(SKIP_TENANT_KEY, context.getHandler()) ||
      this.reflector.get<boolean>(SKIP_TENANT_KEY, context.getClass());

    if (!skipTenant) {
      // Allow root users to access all tenants
      const userAuthInfo = {
        isActive: user.isActive,
        hasPermission: (permission: string) => user.permissions?.includes(permission) || false,
      };

      if (!this.userAuthorizationService.canAccessRootFeatures(userAuthInfo)) {
        // Check if user has tenant context
        if (!user.tenantId || !user.companyId) {
          this.logger.warn({
            message: 'Tenant isolation failed - user not assigned to any company',
            userId: user.sub,
            path: request.url,
          });
          throw new ForbiddenException('User not assigned to any company');
        }
        if (validateTenant) {
          const userTenantId = user.tenantId;
          await this.validateTenantHost(user, request, userTenantId);
        }

        // Inject tenant context into request for use in repositories
        request.tenantId = user.tenantId;
        request.companyId = user.companyId;
      } else {
        const tenantIdHeader = this.extractTenantIdFromRequest(request);
        if (tenantIdHeader && typeof tenantIdHeader === 'string') {
          if (UUID_REGEX.test(tenantIdHeader)) {
            if (validateTenant) {
              const hostTenant = await this.validateTenantHost(user, request, tenantIdHeader);

              user.tenantId = hostTenant.getTenantId();
              user.companyId = hostTenant.id.getValue();

              // Inject tenant context into request for use in repositories
              request.tenantId = hostTenant.getTenantId();
              request.companyId = hostTenant.id;
            } else {
              user.tenantId = tenantIdHeader;
              user.companyId = tenantIdHeader;

              // Inject tenant context into request for use in repositories
              request.tenantId = tenantIdHeader;
              request.companyId = tenantIdHeader;
            }
          } else {
            throw new ForbiddenException('Access denied: Invalid tenant id');
          }
        }
      }
    }

    return true;
  }

  handleRequest(err, user, _info) {
    // You can throw an exception based on either "info" or "err" arguments
    if (err || !user) {
      throw err || new UnauthorizedException('Invalid token or expired session');
    }

    return user;
  }

  private extractTenantIdFromRequest(request: {
    params?: { tenantId?: string };
    headers?: { 'x-tenant-id'?: string };
  }): string | null {
    // Extract tenant ID from request parameters, headers, or query params
    return request.params?.tenantId || request.headers['x-tenant-id'] || null;
  }

  private async validateTenantHost(
    user: IJwtPayload,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    request: any,
    targetTenantId: string,
  ): Promise<Company> {
    // Resolve tenant from host
    const host = this.tenantResolverService.extractHostFromRequest(request);
    if (!host) {
      throw new ForbiddenException('Access denied: Host not found in request');
    }

    const hostTenant = await this.tenantResolverService.resolveTenantFromHost(host);
    if (!hostTenant) {
      throw new ForbiddenException('Access denied: Unknown Host');
    }

    if (hostTenant.getTenantId() !== targetTenantId) {
      this.logger.warn({
        message: 'Tenant isolation failed - host belongs to different tenant',
        userId: user.sub,
        userTenant: targetTenantId,
        hostTenant: hostTenant.getTenantId(),
        path: request.url,
      });
      throw new ForbiddenException('Access denied: Host belongs to different tenant');
    }

    return hostTenant;
  }
}
