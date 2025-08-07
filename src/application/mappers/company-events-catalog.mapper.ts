import { Injectable } from '@nestjs/common';
import { CreateCompanyEventDto } from '@application/dtos/company-events-catalog/create-company-event.dto';
import { UpdateCompanyEventDto } from '@application/dtos/company-events-catalog/update-company-event.dto';
import {
  CompanyEventResponseDto,
  CompanyEventsListResponseDto,
} from '@application/dtos/company-events-catalog/company-event-response.dto';
import {
  CreateCompanyEventCommand,
  ICreateCompanyEventResponse,
} from '@application/commands/company-events-catalog/create-company-event.command';
import {
  UpdateCompanyEventCommand,
  IUpdateCompanyEventResponse,
} from '@application/commands/company-events-catalog/update-company-event.command';
import { DeleteCompanyEventCommand } from '@application/commands/company-events-catalog/delete-company-event.command';
import {
  GetCompanyEventsQuery,
  IGetCompanyEventsResponse,
} from '@application/queries/company-events-catalog/get-company-events.query';
import {
  GetCompanyEventByNameQuery,
  IGetCompanyEventByNameResponse,
} from '@application/queries/company-events-catalog/get-company-event-by-name.query';

@Injectable()
export class CompanyEventsCatalogMapper {
  /**
   * Map DTO to Create Command
   */
  toCreateCommand(
    dto: CreateCompanyEventDto,
    companyId: string,
    currentUserId: string,
  ): CreateCompanyEventCommand {
    return new CreateCompanyEventCommand(
      dto.title,
      dto.description,
      dto.eventName,
      companyId,
      currentUserId,
      dto.iconUrl,
      dto.color,
      dto.isOnline ?? false,
      dto.isPhysical ?? false,
      dto.isAppointment ?? false,
      dto.isActive ?? true,
    );
  }

  /**
   * Map DTO to Update Command
   */
  toUpdateCommand(
    dto: UpdateCompanyEventDto,
    eventName: string,
    companyId: string,
    currentUserId: string,
  ): UpdateCompanyEventCommand {
    return new UpdateCompanyEventCommand(
      eventName,
      companyId,
      currentUserId,
      dto.title,
      dto.description,
      dto.iconUrl,
      dto.color,
      dto.isOnline,
      dto.isPhysical,
      dto.isAppointment,
      dto.isActive,
    );
  }

  /**
   * Create Delete Command
   */
  toDeleteCommand(
    eventName: string,
    companyId: string,
    currentUserId: string,
  ): DeleteCompanyEventCommand {
    return new DeleteCompanyEventCommand(eventName, companyId, currentUserId);
  }

  /**
   * Map query parameters to Get Events Query
   */
  toGetEventsQuery(
    companyId: string,
    filters: {
      isActive?: boolean;
      isOnline?: boolean;
      isPhysical?: boolean;
      isAppointment?: boolean;
      eventNamePattern?: string;
      limit?: number;
      offset?: number;
    } = {},
  ): GetCompanyEventsQuery {
    return new GetCompanyEventsQuery(
      companyId,
      filters.isActive,
      filters.isOnline,
      filters.isPhysical,
      filters.isAppointment,
      filters.eventNamePattern,
      filters.limit,
      filters.offset,
    );
  }

  /**
   * Create Get Event By Name Query
   */
  toGetEventByNameQuery(companyId: string, eventName: string): GetCompanyEventByNameQuery {
    return new GetCompanyEventByNameQuery(companyId, eventName);
  }

  /**
   * Map Create Command Response to DTO
   */
  toCreateResponseDto(response: ICreateCompanyEventResponse): CompanyEventResponseDto {
    return {
      id: response.id,
      eventName: response.eventName,
      title: response.title,
      description: response.description,
      iconUrl: undefined,
      color: undefined,
      isActive: response.isActive,
      isOnline: false,
      isPhysical: false,
      isAppointment: false,
      companyId: response.companyId,
      createdAt: response.createdAt,
      updatedAt: response.createdAt, // Same as created for new records
    };
  }

  /**
   * Map Update Command Response to DTO
   */
  toUpdateResponseDto(response: IUpdateCompanyEventResponse): CompanyEventResponseDto {
    return {
      id: response.id,
      eventName: response.eventName,
      title: response.title,
      description: response.description,
      iconUrl: undefined,
      color: undefined,
      isActive: response.isActive,
      isOnline: false,
      isPhysical: false,
      isAppointment: false,
      companyId: response.companyId,
      createdAt: new Date(), // We don't have this in update response
      updatedAt: response.updatedAt,
    };
  }

  /**
   * Map Query Response to DTO
   */
  toEventResponseDto(response: IGetCompanyEventByNameResponse): CompanyEventResponseDto {
    return {
      id: response.id,
      eventName: response.eventName,
      title: response.title,
      description: response.description,
      iconUrl: response.iconUrl,
      color: response.color,
      isActive: response.isActive,
      isOnline: response.isOnline,
      isPhysical: response.isPhysical,
      isAppointment: response.isAppointment,
      companyId: response.companyId,
      createdAt: response.createdAt,
      updatedAt: response.updatedAt,
    };
  }

  /**
   * Map Events List Query Response to DTO
   */
  toEventsListResponseDto(response: IGetCompanyEventsResponse): CompanyEventsListResponseDto {
    return {
      events: response.events.map(event => ({
        id: event.id,
        eventName: event.eventName,
        title: event.title,
        description: event.description,
        iconUrl: event.iconUrl,
        color: event.color,
        isActive: event.isActive,
        isOnline: event.isOnline,
        isPhysical: event.isPhysical,
        isAppointment: event.isAppointment,
        companyId: event.companyId,
        createdAt: event.createdAt,
        updatedAt: event.updatedAt,
      })),
      total: response.total,
      page: response.page,
    };
  }
}
