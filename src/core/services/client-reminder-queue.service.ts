import { Injectable, Inject } from '@nestjs/common';
import { ClientReminderQueue } from '@core/entities/client-reminder-queue.entity';
import { IClientReminderQueueRepository } from '@core/repositories/client-reminder-queue.repository.interface';
import {
  EntityNotFoundException,
  DuplicateEntityException,
} from '@core/exceptions/domain-exceptions';
import {
  NotificationMedium,
  ReminderNotificationOptOutType,
  ReminderFrequency,
  ReminderQueueStatus,
} from '@prisma/client';

@Injectable()
export class ClientReminderQueueService {
  constructor(
    @Inject('IClientReminderQueueRepository')
    private readonly queueRepository: IClientReminderQueueRepository,
  ) {}

  async createQueue(
    name: string,
    description: string | undefined,
    template: Record<string, any>,
    targetMedium: NotificationMedium,
    notifyType: ReminderNotificationOptOutType,
    callActions: string[],
    active: boolean,
    companyId: string,
    createdBy: string,
    startDate: Date,
    endDate: Date,
    interval: number,
    days: string[],
    startHour: string,
    endHour: string,
    timezone: string,
    frequency: ReminderFrequency,
    maxCount?: number,
    stopUntil?: Date,
    sourceFileName?: string,
    bulkRequestId?: string,
    metadata?: Record<string, any>,
  ): Promise<ClientReminderQueue> {
    // Check for duplicate name
    const existingByName = await this.queueRepository.findByName(name, companyId);
    if (existingByName) {
      throw new DuplicateEntityException('ClientReminderQueue', 'name', name);
    }

    const queue = ClientReminderQueue.create(
      name,
      description,
      template,
      targetMedium,
      notifyType,
      callActions,
      active,
      companyId,
      createdBy,
      startDate,
      endDate,
      interval,
      days,
      startHour,
      endHour,
      timezone,
      frequency,
      maxCount,
      stopUntil,
      sourceFileName,
      bulkRequestId,
      metadata,
    );

    // Get next queue number for the company
    const queueNumber = await this.queueRepository.getNextQueueNumber(companyId);
    queue.setQueueNumber(queueNumber);

    // Check for duplicate hash (should be rare but possible)
    const existingByHash = await this.queueRepository.findByInternalNameHash(
      queue.internalNameHash,
      companyId,
    );
    if (existingByHash) {
      throw new DuplicateEntityException(
        'ClientReminderQueue',
        'internalNameHash',
        queue.internalNameHash,
      );
    }

    const savedQueue = await this.queueRepository.create(queue);

    // If active, trigger refresh to schedule today if applicable
    if (active) {
      await this.queueRepository.refreshQueue(savedQueue.id);
    }

    return savedQueue;
  }

  async updateQueue(
    id: string,
    companyId: string,
    data: {
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
      updatedBy: string;
    },
  ): Promise<ClientReminderQueue> {
    const queue = await this.queueRepository.findById(id, companyId);
    if (!queue) {
      throw new EntityNotFoundException('ClientReminderQueue', id);
    }

    if (!queue.belongsToCompany(companyId)) {
      throw new UnauthorizedQueueAccessException(id, companyId);
    }

    // Check for duplicate name if changing
    if (data.name && data.name !== queue.name) {
      const existingByName = await this.queueRepository.findByName(data.name, companyId);
      if (existingByName) {
        throw new DuplicateEntityException('ClientReminderQueue', 'name', data.name);
      }
    }

    queue.update(data);

    // Check for duplicate hash if name changed
    if (data.name) {
      const existingByHash = await this.queueRepository.findByInternalNameHash(
        queue.internalNameHash,
        companyId,
      );
      if (existingByHash && existingByHash.id !== id) {
        throw new DuplicateEntityException(
          'ClientReminderQueue',
          'internalNameHash',
          queue.internalNameHash,
        );
      }
    }

    const updatedQueue = await this.queueRepository.update(queue);

    // Refresh queue status and schedules if active changed
    if (data.active !== undefined) {
      await this.queueRepository.refreshQueue(updatedQueue.id);
    }

    return updatedQueue;
  }

  async toggleQueueActive(
    id: string,
    companyId: string,
    active: boolean,
    updatedBy: string,
  ): Promise<ClientReminderQueue> {
    const queue = await this.queueRepository.findById(id, companyId);
    if (!queue) {
      throw new EntityNotFoundException('ClientReminderQueue', id);
    }

    if (!queue.belongsToCompany(companyId)) {
      throw new UnauthorizedQueueAccessException(id, companyId);
    }

    queue.setActive(active);
    queue.update({ updatedBy });

    const updatedQueue = await this.queueRepository.update(queue);

    // Refresh queue to update schedules and status
    await this.queueRepository.refreshQueue(updatedQueue.id);

    return updatedQueue;
  }

  async deleteQueue(id: string, companyId: string): Promise<void> {
    const queue = await this.queueRepository.findById(id, companyId);
    if (!queue) {
      throw new EntityNotFoundException('ClientReminderQueue', id);
    }

    if (!queue.belongsToCompany(companyId)) {
      throw new UnauthorizedQueueAccessException(id, companyId);
    }

    await this.queueRepository.delete(id, companyId);
  }

  async getQueueById(id: string, companyId: string): Promise<ClientReminderQueue | null> {
    const queue = await this.queueRepository.findById(id, companyId);
    if (queue && !queue.belongsToCompany(companyId)) {
      throw new UnauthorizedQueueAccessException(id, companyId);
    }

    return queue;
  }

  async getQueuesByCompany(
    companyId: string,
    filters?: {
      status?: ReminderQueueStatus;
      active?: boolean;
    },
    limit?: number,
    offset?: number,
  ): Promise<{ queues: ClientReminderQueue[]; total: number }> {
    const [queues, total] = await Promise.all([
      this.queueRepository.findByCompany(companyId, filters, limit, offset),
      this.queueRepository.countByCompany(companyId, filters),
    ]);

    return { queues, total };
  }

  async refreshAllQueues(): Promise<number> {
    return this.queueRepository.scheduleAndResetQueues();
  }

  async refreshQueue(queueId: string): Promise<{
    scheduledToday: boolean;
    resetCount: number;
    newStatus: ReminderQueueStatus | null;
    todayText: string | null;
  }> {
    return this.queueRepository.refreshQueue(queueId);
  }
}

// Custom exceptions
class UnauthorizedQueueAccessException extends Error {
  constructor(queueId: string, companyId: string) {
    super(`Queue ${queueId} does not belong to company ${companyId}`);
    this.name = 'UnauthorizedQueueAccessException';
  }
}
