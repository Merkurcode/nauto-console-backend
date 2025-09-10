/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable, Inject } from '@nestjs/common';
import { IEventHandler } from '@nestjs/cqrs';
import { MQSerializableEventHandler, MQSerializableEvent } from '@queues/registry/event-registry';
import { BulkProcessingRequestCreatedEvent } from '@core/events/bulk-processing-request.events';
import { ILogger } from '@core/interfaces/logger.interface';
import { LOGGER_SERVICE } from '@shared/constants/tokens';

@MQSerializableEvent('BulkProcessingRequestCreatedMQEvent')
export class BulkProcessingRequestCreatedMQEvent {
  constructor(
    public readonly requestId: string,
    public readonly type: string,
    public readonly fileId: string,
    public readonly fileName: string,
    public readonly companyId: string,
    public readonly requestedBy: string,
    public readonly timestamp: Date = new Date(),
  ) {}

  static fromDomainEvent(
    event: BulkProcessingRequestCreatedEvent,
  ): BulkProcessingRequestCreatedMQEvent {
    return new BulkProcessingRequestCreatedMQEvent(
      event.requestId.toString(),
      event.type,
      event.fileId.toString(),
      event.fileName,
      event.companyId.toString(),
      event.requestedBy.toString(),
      event.occurredOn,
    );
  }

  static fromJSON(data: any): BulkProcessingRequestCreatedMQEvent {
    return new BulkProcessingRequestCreatedMQEvent(
      data.requestId,
      data.type,
      data.fileId,
      data.fileName,
      data.companyId,
      data.requestedBy,
      new Date(data.timestamp),
    );
  }

  toJSON(): Record<string, any> {
    return {
      requestId: this.requestId,
      type: this.type,
      fileId: this.fileId,
      fileName: this.fileName,
      companyId: this.companyId,
      requestedBy: this.requestedBy,
      timestamp: this.timestamp.toISOString(),
    };
  }
}

@Injectable()
@MQSerializableEventHandler(BulkProcessingRequestCreatedMQEvent)
export class BulkProcessingRequestCreatedHandler
  implements IEventHandler<BulkProcessingRequestCreatedMQEvent>
{
  constructor(
    @Inject(LOGGER_SERVICE)
    private readonly logger: ILogger,
  ) {
    this.logger.setContext(BulkProcessingRequestCreatedHandler.name);
  }

  async handle(event: BulkProcessingRequestCreatedMQEvent): Promise<void> {
    // Log the creation for audit purposes
    this.logger.log(
      `[BULK_PROCESSING] Bulk processing request created: ${event.requestId} (${event.type}) ` +
        `for company ${event.companyId}, file: ${event.fileName}`,
    );

    // Additional processing could include:
    // - Sending notifications to administrators
    // - Updating analytics/metrics
    // - Triggering integrations with external systems
    // - Creating audit logs

    // For now, we just log the event
    // In a production system, you might want to:
    // 1. Store in an audit log table
    // 2. Send notifications to relevant users
    // 3. Update company statistics
    // 4. Integrate with monitoring systems
  }
}
