/* eslint-disable prettier/prettier */
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { UserAuthorizationService } from '@core/services/user-authorization.service';
import { IS_PUBLIC_KEY } from '@shared/decorators/public.decorator';
import { IJwtPayload } from '@application/dtos/_responses/user/user.response';
import { Email } from '@core/value-objects/email.vo';
import { RolesEnum } from '@shared/constants/enums';
import { BOT_SPECIAL_PERMISSIONS } from '@shared/constants/bot-permissions';

// Interface for user authorization service compatibility
export interface IUserForAuth {
  email: Email;
  isActive: boolean;
  hasPermission(permissionName: string): boolean;
  rolesCollection: {
    getAllPermissions(): {
      toArray(): Array<{ name: string }>;
    };
  };
}

/**
 * Enhanced PermissionsGuard that uses the UserAuthorizationService
 * for sophisticated permission checking
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly userAuthorizationService: UserAuthorizationService,
    private readonly configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    // Check if the route is marked as public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const jwtPayload: IJwtPayload = request.user;

    if (!jwtPayload) {
      return false;
    }

    // Verificar si tiene el permiso especial BOT (acceso completo)
    if (jwtPayload.permissions?.includes(BOT_SPECIAL_PERMISSIONS.ALL_ACCESS)) {
      return true; // BOT con acceso completo pasa todas las verificaciones
    }

    // Create a user-like object from JWT payload for authorization service
    const userForAuth: IUserForAuth = {
      email: new Email(jwtPayload.email),
      isActive: jwtPayload.isActive,
      rolesCollection: {
        getAllPermissions: () => ({
          toArray: () => (jwtPayload.permissions || []).map(p => ({ name: p })),
        }),
      },
      hasPermission: (permissionName: string) => {
        return (jwtPayload.permissions || []).includes(permissionName);
      },
    };

    // Check for resource and action metadata
    const resource = this.reflector.get<string>('resource', context.getHandler());
    const action = this.reflector.get<string>('action', context.getHandler());

    if (resource && action) {
      return this.userAuthorizationService.canAccessResource(userForAuth, resource, action);
    }

    // Check for root access requirement
    const requiresRoot = this.reflector.get<boolean>(RolesEnum.ROOT, context.getHandler());
    if (requiresRoot) {
      return this.userAuthorizationService.canAccessRootFeatures(userForAuth);
    }

    // Check for sensitive operation requirement
    const requiresSensitive = this.reflector.get<boolean>('sensitive', context.getHandler());
    if (requiresSensitive) {
      // Check if sensitive operations validation is enabled in config
      const sensitiveOperationsEnabled = this.configService.get<boolean>('security.sensitiveOperationsEnabled', true);

      // If disabled in config, skip the 2FA requirement and allow access
      if (!sensitiveOperationsEnabled) {
        return true;
      }

      return this.userAuthorizationService.canPerformSensitiveOperations(userForAuth);
    }

    // Default to authenticated user check
    return true;
  }
}
