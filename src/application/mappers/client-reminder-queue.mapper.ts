import { ClientReminderQueue } from '@core/entities/client-reminder-queue.entity';
import { IClientReminderQueueResponse } from '@application/dtos/_responses/client-reminder-queue/client-reminder-queue.response';

export class ClientReminderQueueMapper {
  static toResponse(queue: ClientReminderQueue): IClientReminderQueueResponse {
    return {
      id: queue.id,
      queueNumber: queue.queueNumber.toString(), // BigInt to string for JSON
      name: queue.name,
      internalNameHash: queue.internalNameHash,
      description: queue.description,
      template: queue.template,
      targetMedium: queue.targetMedium,
      notifyType: queue.notifyType,
      callActions: queue.callActions,
      active: queue.active,
      status: queue.status,
      lastTimeChecked: queue.lastTimeChecked,
      companyId: queue.companyId.getValue(),
      createdBy: queue.createdBy.getValue(),
      updatedBy: queue.updatedBy?.getValue(),
      createdAt: queue.createdAt,
      updatedAt: queue.updatedAt,
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
      metadata: queue.metadata,
    };
  }
}
