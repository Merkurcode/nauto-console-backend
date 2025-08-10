import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CompanyScheduleService } from '@core/services/company-schedule.service';

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
  constructor(private readonly companyScheduleService: CompanyScheduleService) {}

  async execute(command: CreateCompanyScheduleCommand): Promise<ICreateCompanyScheduleResponse> {
    const savedSchedule = await this.companyScheduleService.createCompanySchedule(
      command.companyId,
      command.dayOfWeek,
      command.startTime,
      command.endTime,
      command.currentUserId,
      command.isActive,
    );

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
