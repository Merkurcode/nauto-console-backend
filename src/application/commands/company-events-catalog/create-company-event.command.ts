import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { CompanyEventsCatalog } from '@core/entities/company-events-catalog.entity';
import { ICompanyEventsCatalogRepository } from '@core/repositories/company-events-catalog.repository.interface';
import { CompanyId } from '@core/value-objects/company-id.vo';
import { InvalidInputException, ForbiddenActionException } from '@core/exceptions/domain-exceptions';
import { COMPANY_EVENTS_CATALOG_REPOSITORY, USER_REPOSITORY } from '@shared/constants/tokens';
import { UserAuthorizationService } from '@core/services/user-authorization.service';
import { IUserRepository } from '@core/repositories/user.repository.interface';

export class CreateCompanyEventCommand {
  constructor(
    public readonly title: Record<string, string>,
    public readonly description: Record<string, string>,
    public readonly eventName: string,
    public readonly companyId: string,
    public readonly currentUserId: string,
    public readonly iconUrl?: string,
    public readonly color?: string,
    public readonly isOnline: boolean = false,
    public readonly isPhysical: boolean = false,
    public readonly isAppointment: boolean = false,
    public readonly isActive: boolean = true,
  ) {}
}

export interface ICreateCompanyEventResponse {
  id: string;
  eventName: string;
  title: Record<string, string>;
  description: Record<string, string>;
  companyId: string;
  isActive: boolean;
  createdAt: Date;
}

@CommandHandler(CreateCompanyEventCommand)
export class CreateCompanyEventHandler implements ICommandHandler<CreateCompanyEventCommand> {
  constructor(
    @Inject(COMPANY_EVENTS_CATALOG_REPOSITORY)
    private readonly companyEventsRepository: ICompanyEventsCatalogRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    private readonly userAuthorizationService: UserAuthorizationService,
  ) {}

  async execute(command: CreateCompanyEventCommand): Promise<ICreateCompanyEventResponse> {
    // Validate input
    this.validateCommand(command);

    // Check user authorization
    const currentUser = await this.userAuthorizationService.getCurrentUserSafely(
      command.currentUserId,
    );

    // Verify user can access this company
    if (!this.userAuthorizationService.canAccessCompany(currentUser, command.companyId)) {
      throw new ForbiddenActionException(
        'You do not have permission to create events for this company',
      );
    }

    const companyId = CompanyId.fromString(command.companyId);

    // Check if event name already exists for this company
    const existingEvent = await this.companyEventsRepository.findByCompanyIdAndEventName(
      companyId,
      command.eventName,
    );

    if (existingEvent) {
      throw new InvalidInputException(
        `Event with name '${command.eventName}' already exists for this company`,
      );
    }

    // Create the event catalog entry
    const eventCatalog = CompanyEventsCatalog.create({
      title: command.title,
      description: command.description,
      eventName: command.eventName,
      companyId,
      iconUrl: command.iconUrl,
      color: command.color,
      isOnline: command.isOnline,
      isPhysical: command.isPhysical,
      isAppointment: command.isAppointment,
      isActive: command.isActive,
    });

    // Validate domain entity
    if (!eventCatalog.isValid()) {
      throw new InvalidInputException('Invalid event catalog data');
    }

    // Save to repository
    const savedEvent = await this.companyEventsRepository.create(eventCatalog);

    return {
      id: savedEvent.id.getValue(),
      eventName: savedEvent.eventName,
      title: savedEvent.title,
      description: savedEvent.description,
      companyId: savedEvent.companyId.getValue(),
      isActive: savedEvent.isActive,
      createdAt: savedEvent.createdAt,
    };
  }

  private validateCommand(command: CreateCompanyEventCommand): void {
    if (!command.title || Object.keys(command.title).length === 0) {
      throw new InvalidInputException('Title is required and must contain at least one language');
    }

    if (!command.description || Object.keys(command.description).length === 0) {
      throw new InvalidInputException(
        'Description is required and must contain at least one language',
      );
    }

    if (!command.eventName || command.eventName.trim().length === 0) {
      throw new InvalidInputException('Event name is required');
    }

    if (!command.companyId || command.companyId.trim().length === 0) {
      throw new InvalidInputException('Company ID is required');
    }

    // Validate color format if provided
    if (command.color && !this.isValidColor(command.color)) {
      throw new InvalidInputException('Color must be a valid hex color code (e.g., #FF5733)');
    }

    // Validate URL format if provided
    if (command.iconUrl && !this.isValidUrl(command.iconUrl)) {
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
