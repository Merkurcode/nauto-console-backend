import { Injectable } from '@nestjs/common';
import { PrismaService } from '@infrastructure/database/prisma/prisma.service';
import { IClientReminderQueueRepository } from '@core/repositories/client-reminder-queue.repository.interface';
import { ClientReminderQueue } from '@core/entities/client-reminder-queue.entity';
import { ReminderQueueStatus, Prisma } from '@prisma/client';
import { BaseRepository } from './base.repository';

@Injectable()
export class ClientReminderQueueRepository
  extends BaseRepository<ClientReminderQueue>
  implements IClientReminderQueueRepository
{
  constructor(protected readonly prisma: PrismaService) {
    super();
  }

  async create(queue: ClientReminderQueue): Promise<ClientReminderQueue> {
    return this.executeWithErrorHandling('createClientReminderQueue', async () => {
      const data = await this.prisma.clientReminderQueue.create({
        data: {
          id: queue.id,
          queueNumber: queue.queueNumber,
          name: queue.name,
          internalNameHash: queue.internalNameHash,
          description: queue.description,
          template: queue.template as Prisma.JsonValue,
          targetMedium: queue.targetMedium,
          notifyType: queue.notifyType,
          callActions: queue.callActions,
          active: queue.active,
          status: queue.status,
          companyId: queue.companyId.getValue(),
          createdBy: queue.createdBy.getValue(),
          startDate: queue.startDate,
          endDate: queue.endDate,
          interval: queue.interval,
          days: queue.days,
          startHour: queue.startHour,
          endHour: queue.endHour,
          maxCount: queue.maxCount,
          timezone: queue.timezone,
          frequency: queue.frequency,
          stopUntil: queue.stopUntil,
          sourceFileName: queue.sourceFileName,
          bulkRequestId: queue.bulkRequestId,
          metadata: queue.metadata as Prisma.JsonValue,
        },
      });

      return this.mapToDomain(data);
    });
  }

  async update(queue: ClientReminderQueue): Promise<ClientReminderQueue> {
    return this.executeWithErrorHandling('updateClientReminderQueue', async () => {
      const data = await this.prisma.clientReminderQueue.update({
        where: {
          id: queue.id,
        },
        data: {
          name: queue.name,
          internalNameHash: queue.internalNameHash,
          description: queue.description,
          template: queue.template as Prisma.JsonValue,
          targetMedium: queue.targetMedium,
          notifyType: queue.notifyType,
          callActions: queue.callActions,
          active: queue.active,
          status: queue.status,
          lastTimeChecked: queue.lastTimeChecked,
          updatedBy: queue.updatedBy?.getValue(),
          startDate: queue.startDate,
          endDate: queue.endDate,
          interval: queue.interval,
          days: queue.days,
          startHour: queue.startHour,
          endHour: queue.endHour,
          maxCount: queue.maxCount,
          timezone: queue.timezone,
          frequency: queue.frequency,
          stopUntil: queue.stopUntil,
          metadata: queue.metadata as Prisma.JsonValue,
        },
      });

      return this.mapToDomain(data);
    });
  }

  async delete(id: string, companyId: string): Promise<void> {
    return this.executeWithErrorHandling('deleteClientReminderQueue', async () => {
      await this.prisma.clientReminderQueue.delete({
        where: {
          id,
          companyId,
        },
      });
    });
  }

  async findById(id: string, companyId: string): Promise<ClientReminderQueue | null> {
    return this.executeWithErrorHandling('findClientReminderQueueById', async () => {
      const data = await this.prisma.clientReminderQueue.findFirst({
        where: {
          id,
          companyId,
        },
      });

      return data ? this.mapToDomain(data) : null;
    });
  }

  async findByName(name: string, companyId: string): Promise<ClientReminderQueue | null> {
    return this.executeWithErrorHandling('findClientReminderQueueByName', async () => {
      const data = await this.prisma.clientReminderQueue.findUnique({
        where: {
          companyId_name: {
            companyId,
            name,
          },
        },
      });

      return data ? this.mapToDomain(data) : null;
    });
  }

  async findByInternalNameHash(
    hash: string,
    companyId: string,
  ): Promise<ClientReminderQueue | null> {
    return this.executeWithErrorHandling('findClientReminderQueueByHash', async () => {
      const data = await this.prisma.clientReminderQueue.findUnique({
        where: {
          companyId_internalNameHash: {
            companyId,
            internalNameHash: hash,
          },
        },
      });

      return data ? this.mapToDomain(data) : null;
    });
  }

  async findByQueueNumber(
    queueNumber: bigint,
    companyId: string,
  ): Promise<ClientReminderQueue | null> {
    return this.executeWithErrorHandling('findClientReminderQueueByNumber', async () => {
      const data = await this.prisma.clientReminderQueue.findUnique({
        where: {
          companyId_queueNumber: {
            companyId,
            queueNumber,
          },
        },
      });

      return data ? this.mapToDomain(data) : null;
    });
  }

  async findByCompany(
    companyId: string,
    filters?: {
      status?: ReminderQueueStatus;
      active?: boolean;
    },
    limit = 50,
    offset = 0,
  ): Promise<ClientReminderQueue[]> {
    return this.executeWithErrorHandling('findClientReminderQueuesByCompany', async () => {
      const where: Prisma.ClientReminderQueueWhereInput = {
        companyId,
        ...(filters?.status && { status: filters.status }),
        ...(filters?.active !== undefined && { active: filters.active }),
      };

      const data = await this.prisma.clientReminderQueue.findMany({
        where,
        orderBy: [{ active: 'desc' }, { createdAt: 'desc' }],
        take: limit,
        skip: offset,
      });

      return data.map(item => this.mapToDomain(item));
    });
  }

  async countByCompany(
    companyId: string,
    filters?: {
      status?: ReminderQueueStatus;
      active?: boolean;
    },
  ): Promise<number> {
    return this.executeWithErrorHandling('countClientReminderQueuesByCompany', async () => {
      const where: Prisma.ClientReminderQueueWhereInput = {
        companyId,
        ...(filters?.status && { status: filters.status }),
        ...(filters?.active !== undefined && { active: filters.active }),
      };

      return this.prisma.clientReminderQueue.count({ where });
    });
  }

  async getNextQueueNumber(companyId: string): Promise<bigint> {
    return this.executeWithErrorHandling('getNextQueueNumber', async () => {
      const lastQueue = await this.prisma.clientReminderQueue.findFirst({
        where: { companyId },
        orderBy: { queueNumber: 'desc' },
        select: { queueNumber: true },
      });

      return lastQueue ? BigInt(lastQueue.queueNumber) + BigInt(1) : BigInt(1);
    });
  }

  async scheduleAndResetQueues(): Promise<number> {
    return this.executeWithErrorHandling('scheduleAndResetQueues', async () => {
      const result = await this.prisma.$queryRaw<[{ schedule_today_and_reset_once_crq: number }]>`
        SELECT schedule_today_and_reset_once_crq() as schedule_today_and_reset_once_crq
      `;

      return result[0].schedule_today_and_reset_once_crq;
    });
  }

  async refreshQueue(queueId: string): Promise<{
    scheduledToday: boolean;
    resetCount: number;
    newStatus: ReminderQueueStatus | null;
    todayText: string | null;
  }> {
    return this.executeWithErrorHandling('refreshQueue', async () => {
      const result = await this.prisma.$queryRaw<
        Array<{
          scheduled_today: boolean;
          reset_count: number;
          new_status: ReminderQueueStatus | null;
          today_text: string | null;
        }>
      >`
        SELECT * FROM refresh_client_reminder_queue(${queueId}::uuid)
      `;

      const row = result[0];

      return {
        scheduledToday: row.scheduled_today,
        resetCount: row.reset_count,
        newStatus: row.new_status,
        todayText: row.today_text,
      };
    });
  }

  private mapToDomain(data: any): ClientReminderQueue {
    return ClientReminderQueue.reconstitute(
      data.id,
      data.queueNumber,
      data.name,
      data.internalNameHash,
      data.description,
      data.template as Record<string, any>,
      data.targetMedium,
      data.notifyType,
      data.callActions,
      data.active,
      data.status,
      data.lastTimeChecked,
      data.companyId,
      data.createdBy,
      data.updatedBy,
      data.createdAt,
      data.updatedAt,
      data.startDate,
      data.endDate,
      data.interval,
      data.days,
      data.startHour,
      data.endHour,
      data.maxCount,
      data.timezone,
      data.frequency,
      data.stopUntil,
      data.sourceFileName,
      data.bulkRequestId,
      data.metadata as Record<string, any>,
    );
  }
}
