import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { ICompanyEventsCatalogRepository } from '@core/repositories/company-events-catalog.repository.interface';
import { CompanyId } from '@core/value-objects/company-id.vo';
import { EntityNotFoundException, InvalidInputException } from '@core/exceptions/domain-exceptions';
import { COMPANY_EVENTS_CATALOG_REPOSITORY } from '@shared/constants/tokens';

export class GetCompanyEventByNameQuery {
  constructor(
    public readonly companyId: string,
    public readonly eventName: string,
  ) {}
}

export interface IGetCompanyEventByNameResponse {
  id: string;
  eventName: string;
  title: Record<string, string>;
  description: Record<string, string>;
  iconUrl?: string;
  color?: string;
  isActive: boolean;
  isOnline: boolean;
  isPhysical: boolean;
  isAppointment: boolean;
  companyId: string;
  createdAt: Date;
  updatedAt: Date;
}

@QueryHandler(GetCompanyEventByNameQuery)
export class GetCompanyEventByNameHandler implements IQueryHandler<GetCompanyEventByNameQuery> {
  constructor(
    @Inject(COMPANY_EVENTS_CATALOG_REPOSITORY)
    private readonly companyEventsRepository: ICompanyEventsCatalogRepository,
  ) {}

  async execute(query: GetCompanyEventByNameQuery): Promise<IGetCompanyEventByNameResponse> {
    // Validate input
    this.validateQuery(query);

    const companyId = CompanyId.fromString(query.companyId);

    // Find the event
    const event = await this.companyEventsRepository.findByCompanyIdAndEventName(
      companyId,
      query.eventName,
    );

    if (!event) {
      throw new EntityNotFoundException(
        'CompanyEventsCatalog',
        `${query.companyId}:${query.eventName}`,
      );
    }

    // Map to response format
    return {
      id: event.id.getValue(),
      eventName: event.eventName,
      title: event.title,
      description: event.description,
      iconUrl: event.iconUrl,
      color: event.color,
      isActive: event.isActive,
      isOnline: event.isOnline,
      isPhysical: event.isPhysical,
      isAppointment: event.isAppointment,
      companyId: event.companyId.getValue(),
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
    };
  }

  private validateQuery(query: GetCompanyEventByNameQuery): void {
    if (!query.companyId || query.companyId.trim().length === 0) {
      throw new InvalidInputException('Company ID is required');
    }

    if (!query.eventName || query.eventName.trim().length === 0) {
      throw new InvalidInputException('Event name is required');
    }
  }
}
