import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { ICompanySchedulesRepository } from '@core/repositories/company-schedules.repository.interface';
import { CompanyId } from '@core/value-objects/company-id.vo';
import { InvalidInputException } from '@core/exceptions/domain-exceptions';
import { COMPANY_SCHEDULES_REPOSITORY } from '@shared/constants/tokens';

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
  constructor(
    @Inject(COMPANY_SCHEDULES_REPOSITORY)
    private readonly companySchedulesRepository: ICompanySchedulesRepository,
  ) {}

  async execute(query: GetCompanySchedulesQuery): Promise<IGetCompanySchedulesResponse> {
    // Validate input
    this.validateQuery(query);

    const companyId = CompanyId.fromString(query.companyId);
    const limit = query.limit || 50;
    const offset = query.offset || 0;

    // Execute query
    const result = await this.companySchedulesRepository.findMany({
      companyId,
      isActive: query.isActive,
      dayOfWeek: query.dayOfWeek,
      limit,
      offset,
    });

    // Map to response format
    const schedules: ICompanyScheduleResponse[] = result.schedules.map(schedule => ({
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
      schedules,
      total: result.total,
      page: {
        limit,
        offset,
        hasMore: offset + limit < result.total,
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
