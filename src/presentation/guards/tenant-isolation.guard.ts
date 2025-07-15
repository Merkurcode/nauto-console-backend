import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenantResolverService } from '@presentation/services/tenant-resolver.service';

@Injectable()
export class TenantIsolationGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private tenantResolverService: TenantResolverService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Allow super admins to access all tenants
    if (user.roles?.includes('super-admin')) {
      return true;
    }

    // Check if user has tenant context
    if (!user.tenantId) {
      throw new ForbiddenException('User not assigned to any company');
    }

    // Resolve tenant from host
    const host = this.tenantResolverService.extractHostFromRequest(request);
    if (host) {
      const hostTenant = await this.tenantResolverService.resolveTenantFromHost(host);

      if (hostTenant && hostTenant.getTenantId() !== user.tenantId) {
        throw new ForbiddenException('Access denied: Host belongs to different tenant');
      }
    }

    // Add tenant isolation logic here
    // For example, you can check if the requested resource belongs to the user's tenant
    const tenantId = this.extractTenantIdFromRequest(request);

    if (tenantId && tenantId !== user.tenantId) {
      throw new ForbiddenException('Access denied: Resource belongs to different tenant');
    }

    // Inject tenant context into request for use in repositories
    request.tenantId = user.tenantId;

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
