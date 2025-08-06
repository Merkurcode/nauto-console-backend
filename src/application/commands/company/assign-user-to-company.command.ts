import { ICommand, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable, Inject } from '@nestjs/common';
import { UserId } from '@core/value-objects/user-id.vo';
import { CompanyId } from '@core/value-objects/company-id.vo';
import { IUserRepository } from '@core/repositories/user.repository.interface';
import { ICompanyRepository } from '@core/repositories/company.repository.interface';
import { USER_REPOSITORY, COMPANY_REPOSITORY } from '@shared/constants/tokens';
import {
  EntityNotFoundException,
  ForbiddenActionException,
} from '@core/exceptions/domain-exceptions';
import { UserAuthorizationService } from '@core/services/user-authorization.service';

export class AssignUserToCompanyCommand implements ICommand {
  constructor(
    public readonly userId: UserId,
    public readonly companyId: CompanyId,
    public readonly currentUserId: UserId,
  ) {}
}

@Injectable()
@CommandHandler(AssignUserToCompanyCommand)
export class AssignUserToCompanyCommandHandler
  implements ICommandHandler<AssignUserToCompanyCommand>
{
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(COMPANY_REPOSITORY)
    private readonly companyRepository: ICompanyRepository,
    private readonly userAuthorizationService: UserAuthorizationService,
  ) {}

  async execute(command: AssignUserToCompanyCommand): Promise<void> {
    const { userId, companyId, currentUserId } = command;

    // Get current user using centralized method
    const currentUser = await this.userAuthorizationService.getCurrentUserSafely(
      currentUserId.getValue(),
    );

    // Verify target user exists
    const targetUser = await this.userRepository.findById(userId.getValue());
    if (!targetUser) {
      throw new EntityNotFoundException('User', userId.getValue());
    }

    // Verify company exists
    const company = await this.companyRepository.findById(companyId);
    if (!company) {
      throw new EntityNotFoundException('Company', companyId.getValue());
    }

    // Get current user's company if needed for validation
    const currentUserCompany = currentUser.companyId
      ? await this.companyRepository.findById(currentUser.companyId)
      : null;

    // Use domain service for complete validation (following Clean Architecture)
    const validationResult = this.userAuthorizationService.canAssignUserToCompanyWithValidation(
      currentUser,
      targetUser,
      company,
      currentUserCompany,
    );

    if (!validationResult.canAssign) {
      throw new ForbiddenActionException(
        `Cannot assign user to company. ${validationResult.reason}`,
      );
    }

    // Assign user to company (domain operation)
    targetUser.assignToCompany(companyId);

    // Save the changes (infrastructure operation)
    await this.userRepository.update(targetUser);
  }
}
