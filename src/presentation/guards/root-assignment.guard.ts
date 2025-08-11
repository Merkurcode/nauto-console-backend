import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserAuthorizationService } from '@core/services/user-authorization.service';
import { RolesEnum } from '@shared/constants/enums';
import { PREVENT_ROOT_ASSIGNMENT_KEY } from '@shared/decorators/prevent-root-assignment.decorator';
import { IJwtPayload } from '@application/dtos/_responses/user/user.response';
import { UserService } from '@core/services/user.service';
import { RoleService } from '@core/services/role.service';

/**
 * Guard to prevent assignment of ROOT roles
 * - ROOT role: Cannot be assigned by anyone (must be set in database)
 * - ROOT_READONLY role: Can only be assigned by ROOT users
 */
@Injectable()
export class RootAssignmentGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly userAuthorizationService: UserAuthorizationService,
    private readonly userService: UserService,
    private readonly roleService: RoleService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const preventRootAssignment = this.reflector.get<boolean>(
      PREVENT_ROOT_ASSIGNMENT_KEY,
      context.getHandler(),
    );

    if (!preventRootAssignment) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const jwtUser: IJwtPayload = request.user;
    const body = request.body;

    // Check if user is trying to assign a role
    if (body && body.roleId) {
      // Get the role being assigned
      const roleToAssign = await this.roleService.getRoleById(body.roleId);

      if (!roleToAssign) {
        // Role doesn't exist, let the command handler deal with it
        return true;
      }

      // Check if it's the ROOT role (completely forbidden)
      if (roleToAssign.name === RolesEnum.ROOT) {
        // NOBODY can assign the ROOT role through the API
        // This role must be assigned directly in the database
        return false;
      }

      // Check if it's the ROOT_READONLY role
      if (roleToAssign.name === RolesEnum.ROOT_READONLY) {
        // Only ROOT users can assign ROOT_READONLY role
        const currentUser = await this.userService.getUserById(jwtUser.sub);

        if (
          !currentUser ||
          !this.userAuthorizationService.canAccessRootFeatures(currentUser) ||
          !currentUser.hasRootPrivileges() // To exclude ROOT_READONLY users
        ) {
          // Prevent non-ROOT users from assigning ROOT_READONLY role
          return false;
        }
      }
    }

    return true;
  }
}
