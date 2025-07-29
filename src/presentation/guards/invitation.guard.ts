import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InvitationRulesService } from '@core/services/invitation-rules.service';
import { IJwtPayload } from '@application/dtos/responses/user.response';

@Injectable()
export class InvitationGuard implements CanActivate {
  constructor(private readonly invitationRulesService: InvitationRulesService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user: IJwtPayload = request.user;
    const body = request.body;

    if (!user) {
      throw new ForbiddenException('Authentication required');
    }

    if (!body) {
      throw new BadRequestException('Request body is required');
    }

    // Extract target roles from request body
    const targetRoles = body.roles || ['guest']; // Default to guest if no roles specified
    const targetCompanyId = body.company; // Company name/ID from request body

    // Validate invitation permissions
    const validation = this.invitationRulesService.validateInvitation(
      user.roles,
      targetRoles,
      user.companyId,
      targetCompanyId,
    );

    if (!validation.isValid) {
      throw new ForbiddenException(validation.error);
    }

    return true;
  }
}
