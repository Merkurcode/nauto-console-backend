import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { ICompanyEventsCatalogRepository } from '@core/repositories/company-events-catalog.repository.interface';
import { CompanyId } from '@core/value-objects/company-id.vo';
import { EntityNotFoundException, InvalidInputException } from '@core/exceptions/domain-exceptions';
import { COMPANY_EVENTS_CATALOG_REPOSITORY } from '@shared/constants/tokens';

export class DeleteCompanyEventCommand {
  constructor(
    public readonly eventName: string,
    public readonly companyId: string,
  ) {}
}

@CommandHandler(DeleteCompanyEventCommand)
export class DeleteCompanyEventHandler implements ICommandHandler<DeleteCompanyEventCommand> {
  constructor(
    @Inject(COMPANY_EVENTS_CATALOG_REPOSITORY)
    private readonly companyEventsRepository: ICompanyEventsCatalogRepository,
  ) {}

  async execute(command: DeleteCompanyEventCommand): Promise<void> {
    // Validate input
    this.validateCommand(command);

    const companyId = CompanyId.fromString(command.companyId);

    // Check if event exists
    const existingEvent = await this.companyEventsRepository.findByCompanyIdAndEventName(
      companyId,
      command.eventName,
    );

    if (!existingEvent) {
      throw new EntityNotFoundException(
        'CompanyEventsCatalog',
        `${command.companyId}:${command.eventName}`,
      );
    }

    // Delete the event
    await this.companyEventsRepository.delete(existingEvent.id);
  }

  private validateCommand(command: DeleteCompanyEventCommand): void {
    if (!command.eventName || command.eventName.trim().length === 0) {
      throw new InvalidInputException('Event name is required');
    }

    if (!command.companyId || command.companyId.trim().length === 0) {
      throw new InvalidInputException('Company ID is required');
    }
  }
}
