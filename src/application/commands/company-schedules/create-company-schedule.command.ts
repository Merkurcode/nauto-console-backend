import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { CompanySchedules } from '@core/entities/company-schedules.entity';
import { ICompanySchedulesRepository } from '@core/repositories/company-schedules.repository.interface';
import { IUserRepository } from '@core/repositories/user.repository.interface';
import { UserAuthorizationService } from '@core/services/user-authorization.service';
import { ScheduleValidationService } from '@core/services/schedule-validation.service';
import { CompanyId } from '@core/value-objects/company-id.vo';
import {
  InvalidInputException,
  EntityNotFoundException,
  ForbiddenActionException,
} from '@core/exceptions/domain-exceptions';
import { COMPANY_SCHEDULES_REPOSITORY, USER_REPOSITORY } from '@shared/constants/tokens';

export class CreateCompanyScheduleCommand {
  constructor(
    public readonly companyId: string,
    public readonly dayOfWeek: number, // 0=Sunday, 1=Monday, ..., 6=Saturday
    public readonly startTime: Date, // Time only (hour and minutes)
    public readonly endTime: Date, // Time only (hour and minutes)
    public readonly currentUserId: string, // User making the request
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
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    private readonly userAuthorizationService: UserAuthorizationService,
    private readonly scheduleValidationService: ScheduleValidationService,
  ) {}

  async execute(command: CreateCompanyScheduleCommand): Promise<ICreateCompanyScheduleResponse> {
    // Validate input using domain service
    this.scheduleValidationService.validateScheduleCreation(
      command.companyId,
      command.dayOfWeek,
      command.startTime,
      command.endTime,
    );

    // Validate company access using domain service
    const currentUser = await this.userRepository.findById(command.currentUserId);
    if (!currentUser) {
      throw new EntityNotFoundException('User', command.currentUserId);
    }

    if (!this.userAuthorizationService.canAccessCompany(currentUser, command.companyId)) {
      throw new ForbiddenActionException('You can only create schedules for your assigned company');
    }

    const companyId = CompanyId.fromString(command.companyId);

    // Check if schedule already exists for this company and day
    const existingSchedule = await this.companySchedulesRepository.findByCompanyIdAndDayOfWeek(
      companyId,
      command.dayOfWeek,
    );

    if (existingSchedule) {
      throw new InvalidInputException(
        `Schedule for ${this.scheduleValidationService.getDayName(command.dayOfWeek)} already exists for this company`,
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
        `Time conflict detected with existing schedule for ${this.scheduleValidationService.getDayName(command.dayOfWeek)}`,
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
}
