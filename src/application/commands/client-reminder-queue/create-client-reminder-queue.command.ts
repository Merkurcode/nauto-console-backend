import { CommandHandler, ICommand, ICommandHandler } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { ClientReminderQueueService } from '@core/services/client-reminder-queue.service';
import { ClientReminderQueueMapper } from '@application/mappers/client-reminder-queue.mapper';
import { IClientReminderQueueResponse } from '@application/dtos/_responses/client-reminder-queue/client-reminder-queue.response';
import {
  NotificationMedium,
  ReminderNotificationOptOutType,
  ReminderFrequency,
} from '@prisma/client';

export class CreateClientReminderQueueCommand implements ICommand {
  constructor(
    public readonly name: string,
    public readonly description: string | undefined,
    public readonly template: Record<string, any>,
    public readonly targetMedium: NotificationMedium,
    public readonly notifyType: ReminderNotificationOptOutType,
    public readonly callActions: string[],
    public readonly active: boolean,
    public readonly companyId: string,
    public readonly createdBy: string,
    public readonly startDate: Date,
    public readonly endDate: Date,
    public readonly interval: number,
    public readonly days: string[],
    public readonly startHour: string,
    public readonly endHour: string,
    public readonly timezone: string,
    public readonly frequency: ReminderFrequency,
    public readonly maxCount?: number,
    public readonly stopUntil?: Date,
  ) {}
}

@Injectable()
@CommandHandler(CreateClientReminderQueueCommand)
export class CreateClientReminderQueueCommandHandler
  implements ICommandHandler<CreateClientReminderQueueCommand>
{
  constructor(private readonly queueService: ClientReminderQueueService) {}

  async execute(command: CreateClientReminderQueueCommand): Promise<IClientReminderQueueResponse> {
    const queue = await this.queueService.createQueue(
      command.name,
      command.description,
      command.template,
      command.targetMedium,
      command.notifyType,
      command.callActions,
      command.active,
      command.companyId,
      command.createdBy,
      command.startDate,
      command.endDate,
      command.interval,
      command.days,
      command.startHour,
      command.endHour,
      command.timezone,
      command.frequency,
      command.maxCount,
      command.stopUntil,
    );

    return ClientReminderQueueMapper.toResponse(queue);
  }
}
