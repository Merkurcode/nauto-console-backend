import { ICommand, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { UserId } from '@core/value-objects/user-id.vo';
import { CompanyService } from '@core/services/company.service';

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
  constructor(private readonly companyService: CompanyService) {}

  async execute(command: RemoveUserFromCompanyCommand): Promise<void> {
    const { userId, currentUserId } = command;

    // Use domain service to remove user from company
    await this.companyService.removeUserFromCompany(userId, currentUserId);
  }
}
