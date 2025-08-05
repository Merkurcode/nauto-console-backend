/* eslint-disable prettier/prettier */
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesEnum } from '@shared/constants/enums';
import { ROOT_READONLY_KEY } from '@shared/decorators/root-readonly.decorator';
import { IJwtPayload } from '@application/dtos/responses/user.response';

@Injectable()
export class RootReadOnlyGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const denyForRootReadOnly = this.reflector.get<boolean>(
      ROOT_READONLY_KEY,
      context.getHandler(),
    );

    // If the endpoint is not marked with @DenyForRootReadOnly, allow access
    if (!denyForRootReadOnly) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: IJwtPayload = request.user;

    // Check if user has root_readonly role
    if (user.roles && user.roles.some(role => role === RolesEnum.ROOT_READONLY)) {
      throw new ForbiddenException(
        'Root readonly users cannot perform write operations. This action requires full root privileges.',
      );
    }

    return true;
  }
}