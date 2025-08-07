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

export class UpdateCompanyEventCommand {
  constructor(
    public readonly eventName: string,
    public readonly companyId: string,
    public readonly currentUserId: string,
    public readonly title?: Record<string, string>,
    public readonly description?: Record<string, string>,
    public readonly iconUrl?: string,
    public readonly color?: string,
    public readonly isOnline?: boolean,
    public readonly isPhysical?: boolean,
    public readonly isAppointment?: boolean,
    public readonly isActive?: boolean,
  ) {}
}

export interface IUpdateCompanyEventResponse {
  id: string;
  eventName: string;
  title: Record<string, string>;
  description: Record<string, string>;
  companyId: string;
  isActive: boolean;
  updatedAt: Date;
}

@CommandHandler(UpdateCompanyEventCommand)
export class UpdateCompanyEventHandler implements ICommandHandler<UpdateCompanyEventCommand> {
  constructor(
    @Inject(COMPANY_EVENTS_CATALOG_REPOSITORY)
    private readonly companyEventsRepository: ICompanyEventsCatalogRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    private readonly userAuthorizationService: UserAuthorizationService,
  ) {}

  async execute(command: UpdateCompanyEventCommand): Promise<IUpdateCompanyEventResponse> {
    // Validate input
    this.validateCommand(command);

    // Check user authorization
    const currentUser = await this.userAuthorizationService.getCurrentUserSafely(
      command.currentUserId,
    );

    // Verify user can access this company
    if (!this.userAuthorizationService.canAccessCompany(currentUser, command.companyId)) {
      throw new ForbiddenActionException(
        'You do not have permission to update events for this company',
      );
    }

    const companyId = CompanyId.fromString(command.companyId);

    // Find existing event
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

    // Update fields if provided
    if (command.title !== undefined) {
      existingEvent.updateTitle(command.title);
    }

    if (command.description !== undefined) {
      existingEvent.updateDescription(command.description);
    }

    if (command.iconUrl !== undefined) {
      existingEvent.updateIcon(command.iconUrl);
    }

    if (command.color !== undefined) {
      existingEvent.updateColor(command.color);
    }

    if (command.isOnline !== undefined) {
      existingEvent.toggleOnline(command.isOnline);
    }

    if (command.isPhysical !== undefined) {
      existingEvent.togglePhysical(command.isPhysical);
    }

    if (command.isAppointment !== undefined) {
      existingEvent.toggleAppointment(command.isAppointment);
    }

    if (command.isActive !== undefined) {
      if (command.isActive) {
        existingEvent.activate();
      } else {
        existingEvent.deactivate();
      }
    }

    // Validate updated entity
    if (!existingEvent.isValid()) {
      throw new InvalidInputException('Invalid event catalog data after update');
    }

    // Save changes
    const updatedEvent = await this.companyEventsRepository.update(existingEvent);

    return {
      id: updatedEvent.id.getValue(),
      eventName: updatedEvent.eventName,
      title: updatedEvent.title,
      description: updatedEvent.description,
      companyId: updatedEvent.companyId.getValue(),
      isActive: updatedEvent.isActive,
      updatedAt: updatedEvent.updatedAt,
    };
  }

  private validateCommand(command: UpdateCompanyEventCommand): void {
    if (!command.eventName || command.eventName.trim().length === 0) {
      throw new InvalidInputException('Event name is required');
    }

    if (!command.companyId || command.companyId.trim().length === 0) {
      throw new InvalidInputException('Company ID is required');
    }

    // Validate title if provided
    if (command.title !== undefined && Object.keys(command.title).length === 0) {
      throw new InvalidInputException('Title must contain at least one language when provided');
    }

    // Validate description if provided
    if (command.description !== undefined && Object.keys(command.description).length === 0) {
      throw new InvalidInputException(
        'Description must contain at least one language when provided',
      );
    }

    // Validate color format if provided
    if (command.color !== undefined && command.color && !this.isValidColor(command.color)) {
      throw new InvalidInputException('Color must be a valid hex color code (e.g., #FF5733)');
    }

    // Validate URL format if provided
    if (command.iconUrl !== undefined && command.iconUrl && !this.isValidUrl(command.iconUrl)) {
      throw new InvalidInputException('Icon URL must be a valid URL');
    }
  }

  private isValidColor(color: string): boolean {
    const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;

    return hexColorRegex.test(color);
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);

      return true;
    } catch {
      return false;
    }
  }
}
