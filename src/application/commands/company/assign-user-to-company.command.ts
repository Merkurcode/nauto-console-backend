import { ICommand, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable, Inject, ForbiddenException } from '@nestjs/common';
import { UserId } from '@core/value-objects/user-id.vo';
import { CompanyId } from '@core/value-objects/company-id.vo';
import { User } from '@core/entities/user.entity';
import { IUserRepository } from '@core/repositories/user.repository.interface';
import { ICompanyRepository } from '@core/repositories/company.repository.interface';
import { USER_REPOSITORY, COMPANY_REPOSITORY } from '@shared/constants/tokens';
import { EntityNotFoundException } from '@core/exceptions/domain-exceptions';
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

    // Verify current user exists
    const currentUser = await this.userRepository.findById(currentUserId.getValue());
    if (!currentUser) {
      throw new EntityNotFoundException('Current User', currentUserId.getValue());
    }

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

    // Check hierarchy: current user must have equal or higher hierarchy than target user
    if (!this.userAuthorizationService.canManageUser(currentUser, targetUser)) {
      throw new ForbiddenException(
        'Cannot assign user to company. Current user does not have sufficient hierarchy level to manage this user.',
      );
    }

    // Assign user to company
    targetUser.assignToCompany(companyId);

    // Save the changes
    await this.userRepository.update(targetUser);
  }

}
