import { ICommand, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { UserId } from '@core/value-objects/user-id.vo';
import { CompanyId } from '@core/value-objects/company-id.vo';
import { CompanyService } from '@core/services/company.service';

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
  constructor(private readonly companyService: CompanyService) {}

  async execute(command: AssignUserToCompanyCommand): Promise<void> {
    const { userId, companyId, currentUserId } = command;

    // Use domain service to assign user to company
    await this.companyService.assignUserToCompany(userId, companyId, currentUserId);
  }
}
