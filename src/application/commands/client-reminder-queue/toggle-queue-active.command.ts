import { CommandHandler, ICommand, ICommandHandler } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { ClientReminderQueueService } from '@core/services/client-reminder-queue.service';
import { ClientReminderQueueMapper } from '@application/mappers/client-reminder-queue.mapper';
import { IClientReminderQueueResponse } from '@application/dtos/_responses/client-reminder-queue/client-reminder-queue.response';

export class ToggleQueueActiveCommand implements ICommand {
  constructor(
    public readonly id: string,
    public readonly companyId: string,
    public readonly active: boolean,
    public readonly updatedBy: string,
  ) {}
}

@Injectable()
@CommandHandler(ToggleQueueActiveCommand)
export class ToggleQueueActiveCommandHandler implements ICommandHandler<ToggleQueueActiveCommand> {
  constructor(private readonly queueService: ClientReminderQueueService) {}

  async execute(command: ToggleQueueActiveCommand): Promise<IClientReminderQueueResponse> {
    const queue = await this.queueService.toggleQueueActive(
      command.id,
      command.companyId,
      command.active,
      command.updatedBy,
    );

    return ClientReminderQueueMapper.toResponse(queue);
  }
}
