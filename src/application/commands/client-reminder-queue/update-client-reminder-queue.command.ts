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

export class UpdateClientReminderQueueCommand implements ICommand {
  constructor(
    public readonly id: string,
    public readonly companyId: string,
    public readonly updatedBy: string,
    public readonly data: {
      name?: string;
      description?: string;
      template?: Record<string, any>;
      targetMedium?: NotificationMedium;
      notifyType?: ReminderNotificationOptOutType;
      callActions?: string[];
      active?: boolean;
      startDate?: Date;
      endDate?: Date;
      interval?: number;
      days?: string[];
      startHour?: string;
      endHour?: string;
      maxCount?: number;
      timezone?: string;
      frequency?: ReminderFrequency;
      stopUntil?: Date;
    },
  ) {}
}

@Injectable()
@CommandHandler(UpdateClientReminderQueueCommand)
export class UpdateClientReminderQueueCommandHandler
  implements ICommandHandler<UpdateClientReminderQueueCommand>
{
  constructor(private readonly queueService: ClientReminderQueueService) {}

  async execute(command: UpdateClientReminderQueueCommand): Promise<IClientReminderQueueResponse> {
    const queue = await this.queueService.updateQueue(command.id, command.companyId, {
      ...command.data,
      updatedBy: command.updatedBy,
    });

    return ClientReminderQueueMapper.toResponse(queue);
  }
}
