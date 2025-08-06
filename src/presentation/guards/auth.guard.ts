import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '@shared/decorators/roles.decorator';
import { PERMISSIONS_KEY } from '@shared/decorators/permissions.decorator';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no role or permission requirements, allow access
    if (!requiredRoles && !requiredPermissions) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('User not authenticated');
    }

    // Check roles if required
    if (requiredRoles && requiredRoles.length > 0) {
      const userRoles = user.roles || [];
      const hasRequiredRole = requiredRoles.some(role =>
        userRoles.some(userRole => userRole === role),
      );

      if (!hasRequiredRole) {
        throw new ForbiddenException(
          `User does not have required role: ${requiredRoles.join(', ')}`,
        );
      }
    }

    // Check permissions if required
    if (requiredPermissions && requiredPermissions.length > 0) {
      const userPermissions = user.permissions || [];
      const hasRequiredPermission = requiredPermissions.some(permission =>
        userPermissions.includes(permission),
      );

      if (!hasRequiredPermission) {
        throw new ForbiddenException(
          `User does not have required permission: ${requiredPermissions.join(', ')}`,
        );
      }
    }

    return true;
  }
}
