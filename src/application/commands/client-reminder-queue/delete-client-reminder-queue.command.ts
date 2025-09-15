import { CommandHandler, ICommand, ICommandHandler } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { ClientReminderQueueService } from '@core/services/client-reminder-queue.service';

export class DeleteClientReminderQueueCommand implements ICommand {
  constructor(
    public readonly id: string,
    public readonly companyId: string,
  ) {}
}

@Injectable()
@CommandHandler(DeleteClientReminderQueueCommand)
export class DeleteClientReminderQueueCommandHandler
  implements ICommandHandler<DeleteClientReminderQueueCommand>
{
  constructor(private readonly queueService: ClientReminderQueueService) {}

  async execute(command: DeleteClientReminderQueueCommand): Promise<void> {
    await this.queueService.deleteQueue(command.id, command.companyId);
  }
}
