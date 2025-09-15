import { ClientReminderQueue } from '@core/entities/client-reminder-queue.entity';
import { ReminderQueueStatus } from '@prisma/client';

export interface IClientReminderQueueRepository {
  create(queue: ClientReminderQueue): Promise<ClientReminderQueue>;
  update(queue: ClientReminderQueue): Promise<ClientReminderQueue>;
  delete(id: string, companyId: string): Promise<void>;
  findById(id: string, companyId: string): Promise<ClientReminderQueue | null>;
  findByName(name: string, companyId: string): Promise<ClientReminderQueue | null>;
  findByInternalNameHash(hash: string, companyId: string): Promise<ClientReminderQueue | null>;
  findByQueueNumber(queueNumber: bigint, companyId: string): Promise<ClientReminderQueue | null>;
  findByCompany(
    companyId: string,
    filters?: {
      status?: ReminderQueueStatus;
      active?: boolean;
    },
    limit?: number,
    offset?: number,
  ): Promise<ClientReminderQueue[]>;
  countByCompany(
    companyId: string,
    filters?: {
      status?: ReminderQueueStatus;
      active?: boolean;
    },
  ): Promise<number>;
  getNextQueueNumber(companyId: string): Promise<bigint>;

  // SQL function wrappers
  scheduleAndResetQueues(): Promise<number>;
  refreshQueue(queueId: string): Promise<{
    scheduledToday: boolean;
    resetCount: number;
    newStatus: ReminderQueueStatus | null;
    todayText: string | null;
  }>;
}
