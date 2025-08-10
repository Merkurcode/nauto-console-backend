import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CompanyScheduleService } from '@core/services/company-schedule.service';

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
  constructor(private readonly companyScheduleService: CompanyScheduleService) {}

  async execute(command: UpdateCompanyScheduleCommand): Promise<IUpdateCompanyScheduleResponse> {
    const updatedSchedule = await this.companyScheduleService.updateCompanySchedule(
      command.scheduleId,
      command.currentUserId,
      {
        startTime: command.startTime,
        endTime: command.endTime,
        isActive: command.isActive,
      },
    );

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
