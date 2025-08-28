import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IJwtPayload } from '@application/dtos/_responses/user/user.response';
import { UserAuthorizationService } from '@core/services/user-authorization.service';
import { ILogger } from '@core/interfaces/logger.interface';
import { LOGGER_SERVICE } from '@shared/constants/tokens';
import { SKIP_COMPANY_ASSIGNMENT_KEY } from '@shared/decorators/skip-company-assignment.decorator';

@Injectable()
export class CompanyAssignmentGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private readonly userAuthorizationService: UserAuthorizationService,
    @Inject(LOGGER_SERVICE) private readonly logger: ILogger,
  ) {
    this.logger.setContext(CompanyAssignmentGuard.name);
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user: IJwtPayload = request.user;

    // If no user, let JWT guard handle it
    if (!user) {
      return true;
    }

    // Check if the route is marked to skip company assignment validation
    const skipCompanyAssignment = this.reflector.getAllAndOverride<boolean>(
      SKIP_COMPANY_ASSIGNMENT_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (skipCompanyAssignment) {
      this.logger.debug({
        message: 'Company assignment validation skipped for endpoint',
        userId: user.sub,
        path: request.url,
      });

      return true;
    }

    // Allow root users to access without company assignment
    //const userAuthInfo = {
    //  isActive: user.isActive,
    //  hasPermission: (permission: string) => user.permissions?.includes(permission) || false,
    //};
    //
    //if (this.userAuthorizationService.canAccessRootFeatures(userAuthInfo)) {
    //  this.logger.debug({
    //    message: 'Root user bypassing company assignment requirement',
    //    userId: user.sub,
    //    roles: user.roles,
    //    path: request.url,
    //  });
    //
    //  return true;
    //}

    // Check if user has company assignment
    const hasCompanyAssignment = !!(user.companyId || user.tenantId);

    if (!hasCompanyAssignment) {
      this.logger.warn({
        message: 'Access denied - user not assigned to any company',
        userId: user.sub,
        email: user.email,
        roles: user.roles,
        method: request.method,
        path: request.url,
      });

      throw new ForbiddenException(
        'Access denied. Your account must be assigned to a company to access this resource. Please contact your administrator.',
      );
    }

    //this.logger.debug({
    //  message: 'Company assignment validation passed',
    //  userId: user.sub,
    //  companyId: user.companyId,
    //  tenantId: user.tenantId,
    //  path: request.url,
    //});

    return true;
  }
}
