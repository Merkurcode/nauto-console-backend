import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { ICompanyEventsCatalogRepository } from '@core/repositories/company-events-catalog.repository.interface';
import { CompanyId } from '@core/value-objects/company-id.vo';
import {
  EntityNotFoundException,
  InvalidInputException,
  ForbiddenActionException,
} from '@core/exceptions/domain-exceptions';
import { COMPANY_EVENTS_CATALOG_REPOSITORY, USER_REPOSITORY } from '@shared/constants/tokens';
import { UserAuthorizationService } from '@core/services/user-authorization.service';
import { IUserRepository } from '@core/repositories/user.repository.interface';

export class DeleteCompanyEventCommand {
  constructor(
    public readonly eventName: string,
    public readonly companyId: string,
    public readonly currentUserId: string,
  ) {}
}

@CommandHandler(DeleteCompanyEventCommand)
export class DeleteCompanyEventHandler implements ICommandHandler<DeleteCompanyEventCommand> {
  constructor(
    @Inject(COMPANY_EVENTS_CATALOG_REPOSITORY)
    private readonly companyEventsRepository: ICompanyEventsCatalogRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    private readonly userAuthorizationService: UserAuthorizationService,
  ) {}

  async execute(command: DeleteCompanyEventCommand): Promise<void> {
    // Validate input
    this.validateCommand(command);

    // Check user authorization
    const currentUser = await this.userAuthorizationService.getCurrentUserSafely(
      command.currentUserId,
    );

    // Verify user can access this company
    if (!this.userAuthorizationService.canAccessCompany(currentUser, command.companyId)) {
      throw new ForbiddenActionException(
        'You do not have permission to delete events for this company',
      );
    }

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
