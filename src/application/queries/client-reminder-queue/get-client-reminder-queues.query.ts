import { IQuery, IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { ClientReminderQueueService } from '@core/services/client-reminder-queue.service';
import { ClientReminderQueueMapper } from '@application/mappers/client-reminder-queue.mapper';
import { IClientReminderQueueResponse } from '@application/dtos/_responses/client-reminder-queue/client-reminder-queue.response';
import { ReminderQueueStatus } from '@prisma/client';

export class GetClientReminderQueuesQuery implements IQuery {
  constructor(
    public readonly companyId: string,
    public readonly filters?: {
      status?: ReminderQueueStatus;
      active?: boolean;
    },
    public readonly limit: number = 50,
    public readonly offset: number = 0,
  ) {}
}

export interface IGetClientReminderQueuesResponse {
  queues: IClientReminderQueueResponse[];
  total: number;
  limit: number;
  offset: number;
}

@Injectable()
@QueryHandler(GetClientReminderQueuesQuery)
export class GetClientReminderQueuesQueryHandler
  implements IQueryHandler<GetClientReminderQueuesQuery>
{
  constructor(private readonly queueService: ClientReminderQueueService) {}

  async execute(query: GetClientReminderQueuesQuery): Promise<IGetClientReminderQueuesResponse> {
    const { queues, total } = await this.queueService.getQueuesByCompany(
      query.companyId,
      query.filters,
      query.limit,
      query.offset,
    );

    return {
      queues: queues.map(queue => ClientReminderQueueMapper.toResponse(queue)),
      total,
      limit: query.limit,
      offset: query.offset,
    };
  }
}
