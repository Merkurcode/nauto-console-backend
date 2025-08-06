import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { CompanySchedules } from '@core/entities/company-schedules.entity';
import { ICompanySchedulesRepository } from '@core/repositories/company-schedules.repository.interface';
import { CompanyId } from '@core/value-objects/company-id.vo';
import { InvalidInputException } from '@core/exceptions/domain-exceptions';
import { COMPANY_SCHEDULES_REPOSITORY } from '@shared/constants/tokens';

export class CreateCompanyScheduleCommand {
  constructor(
    public readonly companyId: string,
    public readonly dayOfWeek: number, // 0=Sunday, 1=Monday, ..., 6=Saturday
    public readonly startTime: Date, // Time only (hour and minutes)
    public readonly endTime: Date, // Time only (hour and minutes)
    public readonly isActive: boolean = true,
  ) {}
}

export interface ICreateCompanyScheduleResponse {
  id: string;
  companyId: string;
  dayOfWeek: number;
  dayOfWeekName: string;
  startTime: Date;
  endTime: Date;
  isActive: boolean;
  createdAt: Date;
}

@CommandHandler(CreateCompanyScheduleCommand)
export class CreateCompanyScheduleHandler implements ICommandHandler<CreateCompanyScheduleCommand> {
  constructor(
    @Inject(COMPANY_SCHEDULES_REPOSITORY)
    private readonly companySchedulesRepository: ICompanySchedulesRepository,
  ) {}

  async execute(command: CreateCompanyScheduleCommand): Promise<ICreateCompanyScheduleResponse> {
    // Validate input
    this.validateCommand(command);

    const companyId = CompanyId.fromString(command.companyId);

    // Check if schedule already exists for this company and day
    const existingSchedule = await this.companySchedulesRepository.findByCompanyIdAndDayOfWeek(
      companyId,
      command.dayOfWeek,
    );

    if (existingSchedule) {
      throw new InvalidInputException(
        `Schedule for ${this.getDayName(command.dayOfWeek)} already exists for this company`,
      );
    }

    // Check for time conflicts
    const hasConflict = await this.companySchedulesRepository.hasTimeConflict(
      companyId,
      command.dayOfWeek,
      command.startTime,
      command.endTime,
    );

    if (hasConflict) {
      throw new InvalidInputException(
        `Time conflict detected with existing schedule for ${this.getDayName(command.dayOfWeek)}`,
      );
    }

    // Create the schedule
    const schedule = CompanySchedules.create({
      companyId,
      dayOfWeek: command.dayOfWeek,
      startTime: command.startTime,
      endTime: command.endTime,
      isActive: command.isActive,
    });

    // Validate domain entity
    if (!schedule.isValid()) {
      throw new InvalidInputException('Invalid schedule data');
    }

    // Save to repository
    const savedSchedule = await this.companySchedulesRepository.create(schedule);

    return {
      id: savedSchedule.id.getValue(),
      companyId: savedSchedule.companyId.getValue(),
      dayOfWeek: savedSchedule.dayOfWeek,
      dayOfWeekName: savedSchedule.dayOfWeekName,
      startTime: savedSchedule.startTime,
      endTime: savedSchedule.endTime,
      isActive: savedSchedule.isActive,
      createdAt: savedSchedule.createdAt,
    };
  }

  private validateCommand(command: CreateCompanyScheduleCommand): void {
    if (!command.companyId || command.companyId.trim().length === 0) {
      throw new InvalidInputException('Company ID is required');
    }

    if (command.dayOfWeek < 0 || command.dayOfWeek > 6) {
      throw new InvalidInputException('Day of week must be between 0 (Sunday) and 6 (Saturday)');
    }

    if (!command.startTime || !command.endTime) {
      throw new InvalidInputException('Start time and end time are required');
    }

    if (command.startTime >= command.endTime) {
      throw new InvalidInputException('Start time must be before end time');
    }

    // Validate that it's a reasonable time range (not more than 24 hours)
    const diffMs = command.endTime.getTime() - command.startTime.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    if (diffHours > 24) {
      throw new InvalidInputException('Schedule duration cannot exceed 24 hours');
    }

    if (diffHours < 0.5) {
      throw new InvalidInputException('Schedule duration must be at least 30 minutes');
    }
  }

  private getDayName(dayOfWeek: number): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    return days[dayOfWeek];
  }
}
