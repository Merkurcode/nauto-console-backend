import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { CompanyScheduleService } from '@core/services/company-schedule.service';
import { InvalidInputException } from '@core/exceptions/domain-exceptions';

export class GetCompanySchedulesQuery {
  constructor(
    public readonly companyId: string,
    public readonly isActive?: boolean,
    public readonly dayOfWeek?: number,
    public readonly limit?: number,
    public readonly offset?: number,
  ) {}
}

export interface ICompanyScheduleResponse {
  id: string;
  companyId: string;
  dayOfWeek: number;
  dayOfWeekName: string;
  startTime: Date;
  endTime: Date;
  durationMinutes: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IGetCompanySchedulesResponse {
  schedules: ICompanyScheduleResponse[];
  total: number;
  page: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

@QueryHandler(GetCompanySchedulesQuery)
export class GetCompanySchedulesHandler implements IQueryHandler<GetCompanySchedulesQuery> {
  constructor(private readonly companyScheduleService: CompanyScheduleService) {}

  async execute(query: GetCompanySchedulesQuery): Promise<IGetCompanySchedulesResponse> {
    // Validate input
    this.validateQuery(query);

    // Get schedules from service
    const schedules = await this.companyScheduleService.getCompanySchedules(query.companyId);

    // Apply filters
    let filteredSchedules = schedules;

    if (query.isActive !== undefined) {
      filteredSchedules = filteredSchedules.filter(
        schedule => schedule.isActive === query.isActive,
      );
    }

    if (query.dayOfWeek !== undefined) {
      filteredSchedules = filteredSchedules.filter(
        schedule => schedule.dayOfWeek === query.dayOfWeek,
      );
    }

    // Apply pagination
    const limit = query.limit || 50;
    const offset = query.offset || 0;
    const total = filteredSchedules.length;
    const paginatedSchedules = filteredSchedules.slice(offset, offset + limit);

    // Map to response format
    const scheduleResponses: ICompanyScheduleResponse[] = paginatedSchedules.map(schedule => ({
      id: schedule.id.getValue(),
      companyId: schedule.companyId.getValue(),
      dayOfWeek: schedule.dayOfWeek,
      dayOfWeekName: schedule.dayOfWeekName,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      durationMinutes: schedule.getDurationInMinutes(),
      isActive: schedule.isActive,
      createdAt: schedule.createdAt,
      updatedAt: schedule.updatedAt,
    }));

    return {
      schedules: scheduleResponses,
      total,
      page: {
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    };
  }

  private validateQuery(query: GetCompanySchedulesQuery): void {
    if (!query.companyId || query.companyId.trim().length === 0) {
      throw new InvalidInputException('Company ID is required');
    }

    if (query.dayOfWeek !== undefined && (query.dayOfWeek < 0 || query.dayOfWeek > 6)) {
      throw new InvalidInputException('Day of week must be between 0 (Sunday) and 6 (Saturday)');
    }

    if (query.limit !== undefined && (query.limit < 1 || query.limit > 100)) {
      throw new InvalidInputException('Limit must be between 1 and 100');
    }

    if (query.offset !== undefined && query.offset < 0) {
      throw new InvalidInputException('Offset must be non-negative');
    }
  }
}
