import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CompanyScheduleService } from '@core/services/company-schedule.service';

export class DeleteCompanyScheduleCommand {
  constructor(
    public readonly scheduleId: string,
    public readonly currentUserId: string,
  ) {}
}

@CommandHandler(DeleteCompanyScheduleCommand)
export class DeleteCompanyScheduleHandler implements ICommandHandler<DeleteCompanyScheduleCommand> {
  constructor(private readonly companyScheduleService: CompanyScheduleService) {}

  async execute(command: DeleteCompanyScheduleCommand): Promise<void> {
    await this.companyScheduleService.deleteCompanySchedule(
      command.scheduleId,
      command.currentUserId,
    );
  }
}
