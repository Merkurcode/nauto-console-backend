import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { ICompanySchedulesRepository } from '@core/repositories/company-schedules.repository.interface';
import { CompanyScheduleId } from '@core/value-objects/company-schedule-id.vo';
import { EntityNotFoundException, InvalidInputException } from '@core/exceptions/domain-exceptions';
import { COMPANY_SCHEDULES_REPOSITORY } from '@shared/constants/tokens';

export class DeleteCompanyScheduleCommand {
  constructor(public readonly scheduleId: string) {}
}

@CommandHandler(DeleteCompanyScheduleCommand)
export class DeleteCompanyScheduleHandler implements ICommandHandler<DeleteCompanyScheduleCommand> {
  constructor(
    @Inject(COMPANY_SCHEDULES_REPOSITORY)
    private readonly companySchedulesRepository: ICompanySchedulesRepository,
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

    // Delete the schedule
    await this.companySchedulesRepository.delete(scheduleId);
  }

  private validateCommand(command: DeleteCompanyScheduleCommand): void {
    if (!command.scheduleId || command.scheduleId.trim().length === 0) {
      throw new InvalidInputException('Schedule ID is required');
    }
  }
}
