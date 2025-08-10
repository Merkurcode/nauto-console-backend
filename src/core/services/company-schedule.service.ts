import { Injectable, Inject } from '@nestjs/common';
import { ICompanySchedulesRepository } from '@core/repositories/company-schedules.repository.interface';
import { CompanySchedules } from '@core/entities/company-schedules.entity';
import { CompanyId } from '@core/value-objects/company-id.vo';
import { CompanyScheduleId } from '@core/value-objects/company-schedule-id.vo';
import { UserAuthorizationService } from './user-authorization.service';
import { ScheduleValidationService } from './schedule-validation.service';
import { COMPANY_SCHEDULES_REPOSITORY } from '@shared/constants/tokens';
import {
  InvalidInputException,
  EntityNotFoundException,
  ForbiddenActionException,
} from '@core/exceptions/domain-exceptions';

@Injectable()
export class CompanyScheduleService {
  constructor(
    @Inject(COMPANY_SCHEDULES_REPOSITORY)
    private readonly companySchedulesRepository: ICompanySchedulesRepository,
    private readonly userAuthorizationService: UserAuthorizationService,
    private readonly scheduleValidationService: ScheduleValidationService,
  ) {}

  async createCompanySchedule(
    companyId: string,
    dayOfWeek: number,
    startTime: Date,
    endTime: Date,
    currentUserId: string,
    isActive: boolean = true,
  ): Promise<CompanySchedules> {
    // Validate input using domain service
    this.scheduleValidationService.validateScheduleCreation(
      companyId,
      dayOfWeek,
      startTime,
      endTime,
    );

    // Validate company access using domain service
    const currentUser = await this.userAuthorizationService.getCurrentUserSafely(currentUserId);

    if (!this.userAuthorizationService.canAccessCompany(currentUser, companyId)) {
      throw new ForbiddenActionException('You can only create schedules for your assigned company');
    }

    const companyIdVO = CompanyId.fromString(companyId);

    // Check if schedule already exists for this company and day
    const existingSchedule = await this.companySchedulesRepository.findByCompanyIdAndDayOfWeek(
      companyIdVO,
      dayOfWeek,
    );

    if (existingSchedule) {
      throw new InvalidInputException(
        `Schedule for ${this.scheduleValidationService.getDayName(dayOfWeek)} already exists for this company`,
      );
    }

    // Check for time conflicts
    const hasConflict = await this.companySchedulesRepository.hasTimeConflict(
      companyIdVO,
      dayOfWeek,
      startTime,
      endTime,
    );

    if (hasConflict) {
      throw new InvalidInputException(
        `Time conflict detected with existing schedule for ${this.scheduleValidationService.getDayName(dayOfWeek)}`,
      );
    }

    // Create the schedule
    const schedule = CompanySchedules.create({
      companyId: companyIdVO,
      dayOfWeek,
      startTime,
      endTime,
      isActive,
    });

    // Validate domain entity
    if (!schedule.isValid()) {
      throw new InvalidInputException('Invalid schedule data');
    }

    // Save to repository
    return await this.companySchedulesRepository.create(schedule);
  }

  async updateCompanySchedule(
    scheduleId: string,
    currentUserId: string,
    updates: {
      dayOfWeek?: number;
      startTime?: Date;
      endTime?: Date;
      isActive?: boolean;
    },
  ): Promise<CompanySchedules> {
    // Get the existing schedule
    const scheduleIdVO = CompanyScheduleId.fromString(scheduleId);
    const existingSchedule = await this.companySchedulesRepository.findById(scheduleIdVO);
    if (!existingSchedule) {
      throw new EntityNotFoundException('Company Schedule', scheduleId);
    }

    // Check user authorization
    const currentUser = await this.userAuthorizationService.getCurrentUserSafely(currentUserId);

    if (
      !this.userAuthorizationService.canAccessCompany(
        currentUser,
        existingSchedule.companyId.getValue(),
      )
    ) {
      throw new ForbiddenActionException(
        'You do not have permission to update schedules for this company',
      );
    }

    // Validate new schedule data if provided
    if (
      updates.dayOfWeek !== undefined ||
      updates.startTime !== undefined ||
      updates.endTime !== undefined
    ) {
      const dayOfWeek = updates.dayOfWeek ?? existingSchedule.dayOfWeek;
      const startTime = updates.startTime ?? existingSchedule.startTime;
      const endTime = updates.endTime ?? existingSchedule.endTime;

      this.scheduleValidationService.validateScheduleCreation(
        existingSchedule.companyId.getValue(),
        dayOfWeek,
        startTime,
        endTime,
      );

      // Check for conflicts with other schedules (excluding current one)
      const hasConflict = await this.companySchedulesRepository.hasTimeConflict(
        existingSchedule.companyId,
        dayOfWeek,
        startTime,
        endTime,
      );

      if (hasConflict) {
        throw new InvalidInputException(
          `Time conflict detected with existing schedule for ${this.scheduleValidationService.getDayName(dayOfWeek)}`,
        );
      }
    }

    // Update the schedule
    if (updates.dayOfWeek !== undefined) existingSchedule.updateDayOfWeek(updates.dayOfWeek);
    if (updates.startTime !== undefined) existingSchedule.updateStartTime(updates.startTime);
    if (updates.endTime !== undefined) existingSchedule.updateEndTime(updates.endTime);
    if (updates.isActive !== undefined) existingSchedule.updateIsActive(updates.isActive);

    // Validate domain entity after updates
    if (!existingSchedule.isValid()) {
      throw new InvalidInputException('Invalid schedule data after updates');
    }

    return await this.companySchedulesRepository.update(existingSchedule);
  }

  async deleteCompanySchedule(scheduleId: string, currentUserId: string): Promise<void> {
    // Get the existing schedule
    const scheduleIdVO = CompanyScheduleId.fromString(scheduleId);
    const existingSchedule = await this.companySchedulesRepository.findById(scheduleIdVO);
    if (!existingSchedule) {
      throw new EntityNotFoundException('Company Schedule', scheduleId);
    }

    // Check user authorization
    const currentUser = await this.userAuthorizationService.getCurrentUserSafely(currentUserId);

    if (
      !this.userAuthorizationService.canAccessCompany(
        currentUser,
        existingSchedule.companyId.getValue(),
      )
    ) {
      throw new ForbiddenActionException(
        'You do not have permission to delete schedules for this company',
      );
    }

    await this.companySchedulesRepository.delete(scheduleIdVO);
  }

  async getCompanySchedules(companyId: string): Promise<CompanySchedules[]> {
    const companyIdVO = CompanyId.fromString(companyId);

    return await this.companySchedulesRepository.findByCompanyId(companyIdVO);
  }

  async getCompanyWeeklySchedule(companyId: string): Promise<CompanySchedules[]> {
    const companyIdVO = CompanyId.fromString(companyId);

    return await this.companySchedulesRepository.findByCompanyId(companyIdVO);
  }

  async getCompanyScheduleById(scheduleId: string): Promise<CompanySchedules | null> {
    const scheduleIdVO = CompanyScheduleId.fromString(scheduleId);

    return await this.companySchedulesRepository.findById(scheduleIdVO);
  }
}
