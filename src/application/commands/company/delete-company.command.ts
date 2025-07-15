import { ICommand, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CompanyId } from '@core/value-objects/company-id.vo';

export class DeleteCompanyCommand implements ICommand {
  constructor(public readonly id: CompanyId) {}
}

import { Inject, NotFoundException } from '@nestjs/common';
import { ICompanyRepository } from '@core/repositories/company.repository.interface';
import { COMPANY_REPOSITORY } from '@shared/constants/tokens';

@CommandHandler(DeleteCompanyCommand)
export class DeleteCompanyCommandHandler implements ICommandHandler<DeleteCompanyCommand> {
  constructor(
    @Inject(COMPANY_REPOSITORY)
    private readonly companyRepository: ICompanyRepository,
  ) {}

  async execute(command: DeleteCompanyCommand): Promise<void> {
    const { id } = command;

    // Check if company exists
    const company = await this.companyRepository.findById(id);
    if (!company) {
      throw new NotFoundException('Company not found');
    }

    // Delete company
    await this.companyRepository.delete(id);
  }
}
