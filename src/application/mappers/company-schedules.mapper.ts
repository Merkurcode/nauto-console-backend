import { Injectable } from '@nestjs/common';
import { CreateCompanyScheduleDto } from '@application/dtos/company-schedules/create-company-schedule.dto';
import { UpdateCompanyScheduleDto } from '@application/dtos/company-schedules/update-company-schedule.dto';
import {
  CompanyScheduleResponseDto,
  CompanySchedulesListResponseDto,
  CompanyWeeklyScheduleResponseDto,
} from '@application/dtos/company-schedules/company-schedule-response.dto';
import {
  CreateCompanyScheduleCommand,
  ICreateCompanyScheduleResponse,
} from '@application/commands/company-schedules/create-company-schedule.command';
import {
  UpdateCompanyScheduleCommand,
  IUpdateCompanyScheduleResponse,
} from '@application/commands/company-schedules/update-company-schedule.command';
import { DeleteCompanyScheduleCommand } from '@application/commands/company-schedules/delete-company-schedule.command';
import {
  GetCompanySchedulesQuery,
  IGetCompanySchedulesResponse,
} from '@application/queries/company-schedules/get-company-schedules.query';
import {
  GetCompanyWeeklyScheduleQuery,
  IGetCompanyWeeklyScheduleResponse,
} from '@application/queries/company-schedules/get-company-weekly-schedule.query';

@Injectable()
export class CompanySchedulesMapper {
  /**
   * Map DTO to Create Command
   */
  toCreateCommand(
    dto: CreateCompanyScheduleDto,
    companyId: string,
    currentUserId: string,
  ): CreateCompanyScheduleCommand {
    return new CreateCompanyScheduleCommand(
      companyId,
      dto.dayOfWeek,
      dto.startTime,
      dto.endTime,
      currentUserId,
      dto.isActive ?? true,
    );
  }

  /**
   * Map DTO to Update Command
   */
  toUpdateCommand(
    dto: UpdateCompanyScheduleDto,
    scheduleId: string,
    currentUserId: string,
  ): UpdateCompanyScheduleCommand {
    return new UpdateCompanyScheduleCommand(
      scheduleId,
      currentUserId,
      dto.startTime,
      dto.endTime,
      dto.isActive,
    );
  }

  /**
   * Create Delete Command
   */
  toDeleteCommand(scheduleId: string, currentUserId: string): DeleteCompanyScheduleCommand {
    return new DeleteCompanyScheduleCommand(scheduleId, currentUserId);
  }

  /**
   * Map query parameters to Get Schedules Query
   */
  toGetSchedulesQuery(
    companyId: string,
    filters: {
      isActive?: boolean;
      dayOfWeek?: number;
      limit?: number;
      offset?: number;
    } = {},
  ): GetCompanySchedulesQuery {
    return new GetCompanySchedulesQuery(
      companyId,
      filters.isActive,
      filters.dayOfWeek,
      filters.limit,
      filters.offset,
    );
  }

  /**
   * Create Get Weekly Schedule Query
   */
  toGetWeeklyScheduleQuery(companyId: string): GetCompanyWeeklyScheduleQuery {
    return new GetCompanyWeeklyScheduleQuery(companyId);
  }

  /**
   * Map Create Command Response to DTO
   */
  toCreateResponseDto(response: ICreateCompanyScheduleResponse): CompanyScheduleResponseDto {
    return {
      id: response.id,
      companyId: response.companyId,
      dayOfWeek: response.dayOfWeek,
      dayOfWeekName: response.dayOfWeekName,
      startTime: response.startTime,
      endTime: response.endTime,
      durationMinutes: this.calculateDurationMinutes(response.startTime, response.endTime),
      isActive: response.isActive,
      createdAt: response.createdAt,
      updatedAt: response.createdAt, // Same as created for new records
    };
  }

  /**
   * Map Update Command Response to DTO
   */
  toUpdateResponseDto(response: IUpdateCompanyScheduleResponse): CompanyScheduleResponseDto {
    return {
      id: response.id,
      companyId: response.companyId,
      dayOfWeek: response.dayOfWeek,
      dayOfWeekName: response.dayOfWeekName,
      startTime: response.startTime,
      endTime: response.endTime,
      durationMinutes: this.calculateDurationMinutes(response.startTime, response.endTime),
      isActive: response.isActive,
      createdAt: new Date(), // We don't have this in update response
      updatedAt: response.updatedAt,
    };
  }

  /**
   * Map Schedules List Query Response to DTO
   */
  toSchedulesListResponseDto(
    response: IGetCompanySchedulesResponse,
  ): CompanySchedulesListResponseDto {
    return {
      schedules: response.schedules.map(schedule => ({
        id: schedule.id,
        companyId: schedule.companyId,
        dayOfWeek: schedule.dayOfWeek,
        dayOfWeekName: schedule.dayOfWeekName,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        durationMinutes: schedule.durationMinutes,
        isActive: schedule.isActive,
        createdAt: schedule.createdAt,
        updatedAt: schedule.updatedAt,
      })),
      total: response.total,
      page: response.page,
    };
  }

  /**
   * Map Weekly Schedule Query Response to DTO
   */
  toWeeklyScheduleResponseDto(
    response: IGetCompanyWeeklyScheduleResponse,
  ): CompanyWeeklyScheduleResponseDto {
    return {
      companyId: response.companyId,
      weeklySchedule: response.weeklySchedule.map(schedule => ({
        id: schedule.id,
        companyId: schedule.companyId,
        dayOfWeek: schedule.dayOfWeek,
        dayOfWeekName: schedule.dayOfWeekName,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        durationMinutes: schedule.durationMinutes,
        isActive: schedule.isActive,
        createdAt: schedule.createdAt,
        updatedAt: schedule.updatedAt,
      })),
      summary: {
        totalActiveDays: response.summary.totalActiveDays,
        totalScheduledHours: response.summary.totalScheduledHours,
        averageHoursPerDay: response.summary.averageHoursPerDay,
        daysWithoutSchedule: response.summary.daysWithoutSchedule,
      },
    };
  }

  /**
   * Calculate duration in minutes between two dates
   */
  private calculateDurationMinutes(startTime: Date, endTime: Date): number {
    const diffMs = endTime.getTime() - startTime.getTime();

    return Math.floor(diffMs / (1000 * 60));
  }
}
