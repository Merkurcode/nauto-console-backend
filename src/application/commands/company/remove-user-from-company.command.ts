import { ICommand, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable, Inject } from '@nestjs/common';
import { UserId } from '@core/value-objects/user-id.vo';
import { IUserRepository } from '@core/repositories/user.repository.interface';
import { ICompanyRepository } from '@core/repositories/company.repository.interface';
import { USER_REPOSITORY, COMPANY_REPOSITORY } from '@shared/constants/tokens';
import {
  EntityNotFoundException,
  ForbiddenActionException,
} from '@core/exceptions/domain-exceptions';
import { UserAuthorizationService } from '@core/services/user-authorization.service';

export class RemoveUserFromCompanyCommand implements ICommand {
  constructor(
    public readonly userId: UserId,
    public readonly currentUserId: UserId,
  ) {}
}

@Injectable()
@CommandHandler(RemoveUserFromCompanyCommand)
export class RemoveUserFromCompanyCommandHandler
  implements ICommandHandler<RemoveUserFromCompanyCommand>
{
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    @Inject(COMPANY_REPOSITORY)
    private readonly companyRepository: ICompanyRepository,
    private readonly userAuthorizationService: UserAuthorizationService,
  ) {}

  async execute(command: RemoveUserFromCompanyCommand): Promise<void> {
    const { userId, currentUserId } = command;

    // Get current user using centralized method
    const currentUser = await this.userAuthorizationService.getCurrentUserSafely(
      currentUserId.getValue(),
    );

    // Verify target user exists
    const targetUser = await this.userRepository.findById(userId.getValue());
    if (!targetUser) {
      throw new EntityNotFoundException('User', userId.getValue());
    }

    // Get current user's company if needed for validation
    const currentUserCompany = currentUser.companyId
      ? await this.companyRepository.findById(currentUser.companyId)
      : null;

    // Use domain service for complete validation (following Clean Architecture)
    const validationResult = this.userAuthorizationService.canRemoveUserFromCompanyWithValidation(
      currentUser,
      targetUser,
      currentUserCompany,
    );

    if (!validationResult.canRemove) {
      throw new ForbiddenActionException(
        `Cannot remove user from company. ${validationResult.reason}`,
      );
    }

    // Remove user from company (domain operation)
    targetUser.removeFromCompany();

    // Save the changes (infrastructure operation)
    await this.userRepository.update(targetUser);
  }
}
