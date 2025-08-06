import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { ICompanySchedulesRepository } from '@core/repositories/company-schedules.repository.interface';
import { CompanyId } from '@core/value-objects/company-id.vo';
import { InvalidInputException } from '@core/exceptions/domain-exceptions';
import { COMPANY_SCHEDULES_REPOSITORY } from '@shared/constants/tokens';

export class GetCompanyWeeklyScheduleQuery {
  constructor(public readonly companyId: string) {}
}

export interface IWeeklyScheduleResponse {
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

export interface IGetCompanyWeeklyScheduleResponse {
  companyId: string;
  weeklySchedule: IWeeklyScheduleResponse[];
  summary: {
    totalActiveDays: number;
    totalScheduledHours: number;
    averageHoursPerDay: number;
    daysWithoutSchedule: number[];
  };
}

@QueryHandler(GetCompanyWeeklyScheduleQuery)
export class GetCompanyWeeklyScheduleHandler
  implements IQueryHandler<GetCompanyWeeklyScheduleQuery>
{
  constructor(
    @Inject(COMPANY_SCHEDULES_REPOSITORY)
    private readonly companySchedulesRepository: ICompanySchedulesRepository,
  ) {}

  async execute(query: GetCompanyWeeklyScheduleQuery): Promise<IGetCompanyWeeklyScheduleResponse> {
    // Validate input
    this.validateQuery(query);

    const companyId = CompanyId.fromString(query.companyId);

    // Get weekly schedule (ordered by day of week)
    const schedules = await this.companySchedulesRepository.getWeeklySchedule(companyId);

    // Map to response format
    const weeklySchedule: IWeeklyScheduleResponse[] = schedules.map(schedule => ({
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

    // Calculate summary statistics
    const activeSchedules = weeklySchedule.filter(s => s.isActive);
    const totalActiveDays = activeSchedules.length;
    const totalScheduledMinutes = activeSchedules.reduce((sum, s) => sum + s.durationMinutes, 0);
    const totalScheduledHours = totalScheduledMinutes / 60;
    const averageHoursPerDay = totalActiveDays > 0 ? totalScheduledHours / totalActiveDays : 0;

    // Find days without schedule
    const scheduledDays = new Set(activeSchedules.map(s => s.dayOfWeek));
    const daysWithoutSchedule: number[] = [];
    for (let day = 0; day <= 6; day++) {
      if (!scheduledDays.has(day)) {
        daysWithoutSchedule.push(day);
      }
    }

    return {
      companyId: query.companyId,
      weeklySchedule,
      summary: {
        totalActiveDays,
        totalScheduledHours: Math.round(totalScheduledHours * 100) / 100, // Round to 2 decimals
        averageHoursPerDay: Math.round(averageHoursPerDay * 100) / 100,
        daysWithoutSchedule,
      },
    };
  }

  private validateQuery(query: GetCompanyWeeklyScheduleQuery): void {
    if (!query.companyId || query.companyId.trim().length === 0) {
      throw new InvalidInputException('Company ID is required');
    }
  }
}
