import { IQuery, IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { ClientReminderQueueService } from '@core/services/client-reminder-queue.service';
import { ClientReminderQueueMapper } from '@application/mappers/client-reminder-queue.mapper';
import { IClientReminderQueueResponse } from '@application/dtos/_responses/client-reminder-queue/client-reminder-queue.response';
import { EntityNotFoundException } from '@core/exceptions/domain-exceptions';

export class GetClientReminderQueueQuery implements IQuery {
  constructor(
    public readonly id: string,
    public readonly companyId: string,
  ) {}
}

@Injectable()
@QueryHandler(GetClientReminderQueueQuery)
export class GetClientReminderQueueQueryHandler
  implements IQueryHandler<GetClientReminderQueueQuery>
{
  constructor(private readonly queueService: ClientReminderQueueService) {}

  async execute(query: GetClientReminderQueueQuery): Promise<IClientReminderQueueResponse> {
    const queue = await this.queueService.getQueueById(query.id, query.companyId);

    if (!queue) {
      throw new EntityNotFoundException('ClientReminderQueue', query.id);
    }

    return ClientReminderQueueMapper.toResponse(queue);
  }
}
