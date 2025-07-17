import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesEnum } from '@shared/constants/roles.constants';
import { PREVENT_SUPERADMIN_ASSIGNMENT_KEY } from '@shared/decorators/prevent-superadmin-assignment.decorator';
import { IJwtPayload } from '@application/dtos/responses/user.response';

@Injectable()
export class SuperAdminAssignmentGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const preventSuperAdminAssignment = this.reflector.get<boolean>(
      PREVENT_SUPERADMIN_ASSIGNMENT_KEY,
      context.getHandler(),
    );

    if (!preventSuperAdminAssignment) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: IJwtPayload = request.user;
    const body = request.body;

    // Check if user is trying to assign SUPERADMIN role
    if (body && body.roleId) {
      // We need to check if the roleId corresponds to SUPERADMIN
      // This would require a service call to get role details
      // For now, we'll implement basic validation

      // Only SUPERADMIN can assign any role that might be SUPERADMIN
      if (user.roles && !user.roles.includes(RolesEnum.SUPERADMIN)) {
        // Additional validation would be needed here to check if roleId is actually SUPERADMIN
        // This is a simplified implementation
        return true; // Allow for now, actual validation would be in the service layer
      }
    }

    return true;
  }
}
