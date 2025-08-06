import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { ICompanySchedulesRepository } from '@core/repositories/company-schedules.repository.interface';
import { CompanyScheduleId } from '@core/value-objects/company-schedule-id.vo';
import { EntityNotFoundException, InvalidInputException } from '@core/exceptions/domain-exceptions';
import { COMPANY_SCHEDULES_REPOSITORY } from '@shared/constants/tokens';

export class UpdateCompanyScheduleCommand {
  constructor(
    public readonly scheduleId: string,
    public readonly startTime?: Date,
    public readonly endTime?: Date,
    public readonly isActive?: boolean,
  ) {}
}

export interface IUpdateCompanyScheduleResponse {
  id: string;
  companyId: string;
  dayOfWeek: number;
  dayOfWeekName: string;
  startTime: Date;
  endTime: Date;
  isActive: boolean;
  updatedAt: Date;
}

@CommandHandler(UpdateCompanyScheduleCommand)
export class UpdateCompanyScheduleHandler implements ICommandHandler<UpdateCompanyScheduleCommand> {
  constructor(
    @Inject(COMPANY_SCHEDULES_REPOSITORY)
    private readonly companySchedulesRepository: ICompanySchedulesRepository,
  ) {}

  async execute(command: UpdateCompanyScheduleCommand): Promise<IUpdateCompanyScheduleResponse> {
    // Validate input
    this.validateCommand(command);

    const scheduleId = CompanyScheduleId.fromString(command.scheduleId);

    // Find existing schedule
    const existingSchedule = await this.companySchedulesRepository.findById(scheduleId);

    if (!existingSchedule) {
      throw new EntityNotFoundException('CompanySchedules', command.scheduleId);
    }

    // Prepare new time values
    const newStartTime = command.startTime || existingSchedule.startTime;
    const newEndTime = command.endTime || existingSchedule.endTime;

    // Validate time range if times are being updated
    if (command.startTime !== undefined || command.endTime !== undefined) {
      if (newStartTime >= newEndTime) {
        throw new InvalidInputException('Start time must be before end time');
      }

      // Check for time conflicts with other schedules
      const hasConflict = await this.companySchedulesRepository.hasTimeConflict(
        existingSchedule.companyId,
        existingSchedule.dayOfWeek,
        newStartTime,
        newEndTime,
        scheduleId, // Exclude current schedule from conflict check
      );

      if (hasConflict) {
        throw new InvalidInputException(
          `Time conflict detected with existing schedule for ${existingSchedule.dayOfWeekName}`,
        );
      }

      // Update time range
      existingSchedule.updateTimeRange(newStartTime, newEndTime);
    }

    // Update active status if provided
    if (command.isActive !== undefined) {
      if (command.isActive) {
        existingSchedule.activate();
      } else {
        existingSchedule.deactivate();
      }
    }

    // Validate updated entity
    if (!existingSchedule.isValid()) {
      throw new InvalidInputException('Invalid schedule data after update');
    }

    // Save changes
    const updatedSchedule = await this.companySchedulesRepository.update(existingSchedule);

    return {
      id: updatedSchedule.id.getValue(),
      companyId: updatedSchedule.companyId.getValue(),
      dayOfWeek: updatedSchedule.dayOfWeek,
      dayOfWeekName: updatedSchedule.dayOfWeekName,
      startTime: updatedSchedule.startTime,
      endTime: updatedSchedule.endTime,
      isActive: updatedSchedule.isActive,
      updatedAt: updatedSchedule.updatedAt,
    };
  }

  private validateCommand(command: UpdateCompanyScheduleCommand): void {
    if (!command.scheduleId || command.scheduleId.trim().length === 0) {
      throw new InvalidInputException('Schedule ID is required');
    }

    // Validate time range if both times are provided
    if (command.startTime && command.endTime) {
      if (command.startTime >= command.endTime) {
        throw new InvalidInputException('Start time must be before end time');
      }

      // Validate duration
      const diffMs = command.endTime.getTime() - command.startTime.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      if (diffHours > 24) {
        throw new InvalidInputException('Schedule duration cannot exceed 24 hours');
      }

      if (diffHours < 0.5) {
        throw new InvalidInputException('Schedule duration must be at least 30 minutes');
      }
    }
  }
}
