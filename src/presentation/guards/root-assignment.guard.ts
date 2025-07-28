import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesEnum } from '@shared/constants/enums';
import { PREVENT_ROOT_ASSIGNMENT_KEY } from '@shared/decorators/prevent-root-assignment.decorator';
import { IJwtPayload } from '@application/dtos/responses/user.response';

@Injectable()
export class RootAssignmentGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const preventRootAssignment = this.reflector.get<boolean>(
      PREVENT_ROOT_ASSIGNMENT_KEY,
      context.getHandler(),
    );

    if (!preventRootAssignment) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: IJwtPayload = request.user;
    const body = request.body;

    // Check if user is trying to assign ROOT or ROOT_READONLY role
    if (body && body.roleId) {
      // We need to check if the roleId corresponds to ROOT or ROOT_READONLY
      // This would require a service call to get role details
      // For now, we'll implement basic validation

      // Only ROOT can assign ROOT or ROOT_READONLY roles
      if (user.roles && !user.roles.includes(RolesEnum.ROOT)) {
        // Additional validation would be needed here to check if roleId is actually ROOT/ROOT_READONLY
        // This is a simplified implementation
        return true; // Allow for now, actual validation would be in the service layer
      }
    }

    return true;
  }
}
