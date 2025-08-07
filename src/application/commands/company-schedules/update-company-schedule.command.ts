import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { ICompanySchedulesRepository } from '@core/repositories/company-schedules.repository.interface';
import { IUserRepository } from '@core/repositories/user.repository.interface';
import { UserAuthorizationService } from '@core/services/user-authorization.service';
import { ScheduleValidationService } from '@core/services/schedule-validation.service';
import { CompanyScheduleId } from '@core/value-objects/company-schedule-id.vo';
import {
  EntityNotFoundException,
  InvalidInputException,
  ForbiddenActionException,
} from '@core/exceptions/domain-exceptions';
import { COMPANY_SCHEDULES_REPOSITORY, USER_REPOSITORY } from '@shared/constants/tokens';

export class UpdateCompanyScheduleCommand {
  constructor(
    public readonly scheduleId: string,
    public readonly currentUserId: string,
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
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    private readonly userAuthorizationService: UserAuthorizationService,
    private readonly scheduleValidationService: ScheduleValidationService,
  ) {}

  async execute(command: UpdateCompanyScheduleCommand): Promise<IUpdateCompanyScheduleResponse> {
    // Validate input using domain service
    this.scheduleValidationService.validateScheduleUpdate(
      command.scheduleId,
      command.startTime,
      command.endTime,
    );

    const scheduleId = CompanyScheduleId.fromString(command.scheduleId);

    // Find existing schedule
    const existingSchedule = await this.companySchedulesRepository.findById(scheduleId);

    if (!existingSchedule) {
      throw new EntityNotFoundException('CompanySchedules', command.scheduleId);
    }

    // Validate company access using domain service
    const currentUser = await this.userRepository.findById(command.currentUserId);
    if (!currentUser) {
      throw new EntityNotFoundException('User', command.currentUserId);
    }

    if (
      !this.userAuthorizationService.canAccessCompany(
        currentUser,
        existingSchedule.companyId.getValue(),
      )
    ) {
      throw new ForbiddenActionException('You can only update schedules for your assigned company');
    }

    // Prepare new time values
    const newStartTime = command.startTime || existingSchedule.startTime;
    const newEndTime = command.endTime || existingSchedule.endTime;

    // Validate time range if times are being updated
    if (command.startTime !== undefined || command.endTime !== undefined) {
      this.scheduleValidationService.validateScheduleDuration(newStartTime, newEndTime);

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
}
