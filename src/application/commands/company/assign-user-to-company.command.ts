import { ICommand, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable, Inject } from '@nestjs/common';
import { UserId } from '@core/value-objects/user-id.vo';
import { CompanyId } from '@core/value-objects/company-id.vo';
import { IUserRepository } from '@core/repositories/user.repository.interface';
import { ICompanyRepository } from '@core/repositories/company.repository.interface';
import { USER_REPOSITORY, COMPANY_REPOSITORY } from '@shared/constants/tokens';
import { EntityNotFoundException } from '@core/exceptions/domain-exceptions';

export class AssignUserToCompanyCommand implements ICommand {
  constructor(
    public readonly userId: UserId,
    public readonly companyId: CompanyId,
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
  ) {}

  async execute(command: AssignUserToCompanyCommand): Promise<void> {
    const { userId, companyId } = command;

    // Verify user exists
    const user = await this.userRepository.findById(userId.getValue());
    if (!user) {
      throw new EntityNotFoundException('User', userId.getValue());
    }

    // Verify company exists
    const company = await this.companyRepository.findById(companyId);
    if (!company) {
      throw new EntityNotFoundException('Company', companyId.getValue());
    }

    // Assign user to company
    user.assignToCompany(companyId);

    // Save the changes
    await this.userRepository.update(user);
  }
}
