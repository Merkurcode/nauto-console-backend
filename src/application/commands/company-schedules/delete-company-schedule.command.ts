import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { ICompanySchedulesRepository } from '@core/repositories/company-schedules.repository.interface';
import { IUserRepository } from '@core/repositories/user.repository.interface';
import { UserAuthorizationService } from '@core/services/user-authorization.service';
import { CompanyScheduleId } from '@core/value-objects/company-schedule-id.vo';
import { EntityNotFoundException, InvalidInputException, ForbiddenActionException } from '@core/exceptions/domain-exceptions';
import { COMPANY_SCHEDULES_REPOSITORY, USER_REPOSITORY } from '@shared/constants/tokens';

export class DeleteCompanyScheduleCommand {
  constructor(
    public readonly scheduleId: string,
    public readonly currentUserId: string,
  ) {}
}

@CommandHandler(DeleteCompanyScheduleCommand)
export class DeleteCompanyScheduleHandler implements ICommandHandler<DeleteCompanyScheduleCommand> {
  constructor(
    @Inject(COMPANY_SCHEDULES_REPOSITORY)
    private readonly companySchedulesRepository: ICompanySchedulesRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    private readonly userAuthorizationService: UserAuthorizationService,
  ) {}

  async execute(command: DeleteCompanyScheduleCommand): Promise<void> {
    // Validate input
    this.validateCommand(command);

    const scheduleId = CompanyScheduleId.fromString(command.scheduleId);

    // Check if schedule exists
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
      throw new ForbiddenActionException('You can only delete schedules for your assigned company');
    }

    // Delete the schedule
    await this.companySchedulesRepository.delete(scheduleId);
  }

  private validateCommand(command: DeleteCompanyScheduleCommand): void {
    if (!command.scheduleId || command.scheduleId.trim().length === 0) {
      throw new InvalidInputException('Schedule ID is required');
    }
  }
}
