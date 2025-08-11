import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InvitationRulesService } from '@core/services/invitation-rules.service';
import { IJwtPayload } from '@application/dtos/_responses/user/user.response';
import { CompanyService } from '@core/services/company.service';
import { CompanyName } from '@core/value-objects/company-name.vo';
import { RolesEnum } from '@shared/constants/enums';

@Injectable()
export class InvitationGuard implements CanActivate {
  constructor(
    private readonly invitationRulesService: InvitationRulesService,
    private readonly companyService: CompanyService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
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
    const targetRoles = body.roles || [RolesEnum.GUEST]; // Default to guest if no roles specified
    const targetCompanyName = body.company; // Company name from request body

    // Convert company name to company ID for comparison
    let targetCompanyId: string | undefined;
    if (targetCompanyName) {
      const companyNameVO = new CompanyName(targetCompanyName);
      const targetCompany = await this.companyService.getCompanyByName(companyNameVO);
      targetCompanyId = targetCompany?.id.getValue();
    }

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
