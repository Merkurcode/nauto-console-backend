import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenantResolverService } from '@presentation/services/tenant-resolver.service';
import { UserAuthorizationService } from '@core/services/user-authorization.service';
import { IJwtPayload } from '@application/dtos/responses/user.response';
import { SKIP_TENANT_KEY } from '@shared/decorators/skip-tenant.decorator';
import { IS_PUBLIC_KEY } from '@shared/decorators/public.decorator';
import { ILogger } from '@core/interfaces/logger.interface';
import { LOGGER_SERVICE } from '@shared/constants/tokens';

@Injectable()
export class TenantIsolationGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private tenantResolverService: TenantResolverService,
    private userAuthorizationService: UserAuthorizationService,
    @Inject(LOGGER_SERVICE)
    private readonly logger: ILogger,
  ) {
    this.logger.setContext(TenantIsolationGuard.name);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Check if tenant isolation should be skipped (explicit skip or public endpoint)
    const skipTenant =
      this.reflector.get<boolean>(SKIP_TENANT_KEY, context.getHandler()) ||
      this.reflector.get<boolean>(SKIP_TENANT_KEY, context.getClass());

    const isPublic =
      this.reflector.get<boolean>(IS_PUBLIC_KEY, context.getHandler()) ||
      this.reflector.get<boolean>(IS_PUBLIC_KEY, context.getClass());

    if (skipTenant || isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: IJwtPayload = request.user;

    if (!user) {
      this.logger.warn({
        message: 'Tenant isolation failed - user not authenticated',
        path: request.url,
        method: request.method,
      });
      throw new ForbiddenException('User not authenticated');
    }

    // Allow root users to access all tenants
    // Create IUserAuthInfo compatible object for authorization check
    const userAuthInfo = {
      isActive: user.isActive,
      hasPermission: (permission: string) => user.permissions?.includes(permission) || false,
    };

    if (this.userAuthorizationService.canAccessRootFeatures(userAuthInfo)) {
      this.logger.debug({
        message: 'Tenant isolation bypassed for root user',
        userId: user.sub,
        path: request.url,
      });

      return true;
    }

    // Check if user has tenant context
    if (!user.tenantId && !user.companyId) {
      this.logger.warn({
        message: 'Tenant isolation failed - user not assigned to any company',
        userId: user.sub,
        path: request.url,
      });
      throw new ForbiddenException('User not assigned to any company');
    }

    const userTenantId = user.tenantId || user.companyId;

    // Resolve tenant from host
    const host = this.tenantResolverService.extractHostFromRequest(request);
    if (host) {
      const hostTenant = await this.tenantResolverService.resolveTenantFromHost(host);

      if (hostTenant && hostTenant.getTenantId() !== userTenantId) {
        this.logger.warn({
          message: 'Tenant isolation failed - host belongs to different tenant',
          userId: user.sub,
          userTenant: userTenantId,
          hostTenant: hostTenant.getTenantId(),
          path: request.url,
        });
        throw new ForbiddenException('Access denied: Host belongs to different tenant');
      }
    }

    // Check if the requested resource belongs to the user's tenant
    const resourceTenantId = this.extractTenantIdFromRequest(request);

    if (resourceTenantId && resourceTenantId !== userTenantId) {
      this.logger.warn({
        message: 'Tenant isolation failed - resource belongs to different tenant',
        userId: user.sub,
        userTenant: userTenantId,
        resourceTenant: resourceTenantId,
        path: request.url,
      });
      throw new ForbiddenException('Access denied: Resource belongs to different tenant');
    }

    // Inject tenant context into request for use in repositories
    request.tenantId = userTenantId;
    request.companyId = userTenantId; // For backward compatibility

    this.logger.debug({
      message: 'Tenant isolation passed',
      userId: user.sub,
      tenantId: userTenantId,
      path: request.url,
    });

    return true;
  }

  private extractTenantIdFromRequest(request: {
    params?: { tenantId?: string };
    headers?: { 'x-tenant-id'?: string };
  }): string | null {
    // Extract tenant ID from request parameters, headers, or query params
    // This is a placeholder implementation
    return request.params?.tenantId || request.headers['x-tenant-id'] || null;
  }
}
