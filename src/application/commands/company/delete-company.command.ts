import { ICommand, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CompanyId } from '@core/value-objects/company-id.vo';

export class DeleteCompanyCommand implements ICommand {
  constructor(public readonly id: CompanyId) {}
}

import { CompanyService } from '@core/services/company.service';

@CommandHandler(DeleteCompanyCommand)
export class DeleteCompanyCommandHandler implements ICommandHandler<DeleteCompanyCommand> {
  constructor(private readonly companyService: CompanyService) {}

  async execute(command: DeleteCompanyCommand): Promise<void> {
    const { id } = command;

    // Use domain service to delete company
    await this.companyService.deleteCompany(id);
  }
}
