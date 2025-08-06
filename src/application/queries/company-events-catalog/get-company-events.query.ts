import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { ICompanyEventsCatalogRepository } from '@core/repositories/company-events-catalog.repository.interface';
import { CompanyId } from '@core/value-objects/company-id.vo';
import { InvalidInputException } from '@core/exceptions/domain-exceptions';
import { COMPANY_EVENTS_CATALOG_REPOSITORY } from '@shared/constants/tokens';

export class GetCompanyEventsQuery {
  constructor(
    public readonly companyId: string,
    public readonly isActive?: boolean,
    public readonly isOnline?: boolean,
    public readonly isPhysical?: boolean,
    public readonly isAppointment?: boolean,
    public readonly eventNamePattern?: string,
    public readonly limit?: number,
    public readonly offset?: number,
  ) {}
}

export interface ICompanyEventResponse {
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

export interface IGetCompanyEventsResponse {
  events: ICompanyEventResponse[];
  total: number;
  page: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

@QueryHandler(GetCompanyEventsQuery)
export class GetCompanyEventsHandler implements IQueryHandler<GetCompanyEventsQuery> {
  constructor(
    @Inject(COMPANY_EVENTS_CATALOG_REPOSITORY)
    private readonly companyEventsRepository: ICompanyEventsCatalogRepository,
  ) {}

  async execute(query: GetCompanyEventsQuery): Promise<IGetCompanyEventsResponse> {
    // Validate input
    this.validateQuery(query);

    const companyId = CompanyId.fromString(query.companyId);
    const limit = query.limit || 50;
    const offset = query.offset || 0;

    // Execute query
    const result = await this.companyEventsRepository.findMany({
      companyId,
      isActive: query.isActive,
      isOnline: query.isOnline,
      isPhysical: query.isPhysical,
      isAppointment: query.isAppointment,
      eventNamePattern: query.eventNamePattern,
      limit,
      offset,
    });

    // Map to response format
    const events: ICompanyEventResponse[] = result.events.map(event => ({
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
    }));

    return {
      events,
      total: result.total,
      page: {
        limit,
        offset,
        hasMore: offset + limit < result.total,
      },
    };
  }

  private validateQuery(query: GetCompanyEventsQuery): void {
    if (!query.companyId || query.companyId.trim().length === 0) {
      throw new InvalidInputException('Company ID is required');
    }

    if (query.limit !== undefined && (query.limit < 1 || query.limit > 100)) {
      throw new InvalidInputException('Limit must be between 1 and 100');
    }

    if (query.offset !== undefined && query.offset < 0) {
      throw new InvalidInputException('Offset must be non-negative');
    }
  }
}
