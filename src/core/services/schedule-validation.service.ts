import { Injectable } from '@nestjs/common';
import { InvalidInputException } from '@core/exceptions/domain-exceptions';

/**
 * Domain service responsible for schedule-related business rules and validation
 */
@Injectable()
export class ScheduleValidationService {
  private static readonly MAX_SCHEDULE_HOURS = 24;
  private static readonly MIN_SCHEDULE_MINUTES = 30;
  private static readonly MIN_DAY_OF_WEEK = 0; // Sunday
  private static readonly MAX_DAY_OF_WEEK = 6; // Saturday

  /**
   * Validates schedule duration business rules
   * Business Rules:
   * - Duration cannot exceed 24 hours
   * - Duration must be at least 30 minutes
   * - Start time must be before end time
   */
  validateScheduleDuration(startTime: Date, endTime: Date): void {
    if (!startTime || !endTime) {
      throw new InvalidInputException('Start time and end time are required');
    }

    if (startTime >= endTime) {
      throw new InvalidInputException('Start time must be before end time');
    }

    const diffMs = endTime.getTime() - startTime.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    const diffMinutes = diffMs / (1000 * 60);

    if (diffHours > ScheduleValidationService.MAX_SCHEDULE_HOURS) {
      throw new InvalidInputException('Schedule duration cannot exceed 24 hours');
    }

    if (diffMinutes < ScheduleValidationService.MIN_SCHEDULE_MINUTES) {
      throw new InvalidInputException('Schedule duration must be at least 30 minutes');
    }
  }

  /**
   * Validates day of week value
   * Business Rule: Day of week must be between 0 (Sunday) and 6 (Saturday)
   */
  validateDayOfWeek(dayOfWeek: number): void {
    if (
      dayOfWeek < ScheduleValidationService.MIN_DAY_OF_WEEK ||
      dayOfWeek > ScheduleValidationService.MAX_DAY_OF_WEEK
    ) {
      throw new InvalidInputException('Day of week must be between 0 (Sunday) and 6 (Saturday)');
    }
  }

  /**
   * Validates complete schedule creation parameters
   * Encapsulates all schedule creation business rules
   */
  validateScheduleCreation(
    companyId: string,
    dayOfWeek: number,
    startTime: Date,
    endTime: Date,
  ): void {
    if (!companyId || companyId.trim().length === 0) {
      throw new InvalidInputException('Company ID is required');
    }

    this.validateDayOfWeek(dayOfWeek);
    this.validateScheduleDuration(startTime, endTime);
  }

  /**
   * Validates schedule update parameters
   * Business Rule: Only provided fields need validation
   */
  validateScheduleUpdate(scheduleId: string, startTime?: Date, endTime?: Date): void {
    if (!scheduleId || scheduleId.trim().length === 0) {
      throw new InvalidInputException('Schedule ID is required');
    }

    // Only validate duration if both times are provided or being updated
    if (startTime !== undefined || endTime !== undefined) {
      // If only one time is provided, we'll validate it in the command handler
      // after getting the current values
      if (startTime !== undefined && endTime !== undefined) {
        this.validateScheduleDuration(startTime, endTime);
      }
    }
  }

  /**
   * Gets friendly day name for display purposes
   * Business logic for day name mapping
   */
  getDayName(dayOfWeek: number): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    if (dayOfWeek < 0 || dayOfWeek >= days.length) {
      throw new InvalidInputException(`Invalid day of week: ${dayOfWeek}`);
    }

    return days[dayOfWeek];
  }
}
