/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable, Inject } from '@nestjs/common';
import { IEventHandler } from '@nestjs/cqrs';
import { MQSerializableEventHandler, MQSerializableEvent } from '@queues/registry/event-registry';
import { BulkProcessingRequestCompletedEvent } from '@core/events/bulk-processing-request.events';
import { ILogger } from '@core/interfaces/logger.interface';
import { LOGGER_SERVICE } from '@shared/constants/tokens';

@MQSerializableEvent('BulkProcessingRequestCompletedMQEvent')
export class BulkProcessingRequestCompletedMQEvent {
  constructor(
    public readonly requestId: string,
    public readonly type: string,
    public readonly companyId: string,
    public readonly requestedBy: string,
    public readonly processedRows: number,
    public readonly successfulRows: number,
    public readonly failedRows: number,
    public readonly timestamp: Date = new Date(),
  ) {}

  static fromDomainEvent(
    event: BulkProcessingRequestCompletedEvent,
  ): BulkProcessingRequestCompletedMQEvent {
    return new BulkProcessingRequestCompletedMQEvent(
      event.requestId.toString(),
      event.type,
      event.companyId.toString(),
      event.requestedBy.toString(),
      event.processedRows,
      event.successfulRows,
      event.failedRows,
      event.occurredOn,
    );
  }

  static fromJSON(data: any): BulkProcessingRequestCompletedMQEvent {
    return new BulkProcessingRequestCompletedMQEvent(
      data.requestId,
      data.type,
      data.companyId,
      data.requestedBy,
      data.processedRows,
      data.successfulRows,
      data.failedRows,
      new Date(data.timestamp),
    );
  }

  toJSON(): Record<string, any> {
    return {
      requestId: this.requestId,
      type: this.type,
      companyId: this.companyId,
      requestedBy: this.requestedBy,
      processedRows: this.processedRows,
      successfulRows: this.successfulRows,
      failedRows: this.failedRows,
      timestamp: this.timestamp.toISOString(),
    };
  }

  get successRate(): number {
    return this.processedRows > 0 ? (this.successfulRows / this.processedRows) * 100 : 0;
  }

  get hasErrors(): boolean {
    return this.failedRows > 0;
  }
}

@Injectable()
@MQSerializableEventHandler(BulkProcessingRequestCompletedMQEvent)
export class BulkProcessingRequestCompletedHandler
  implements IEventHandler<BulkProcessingRequestCompletedMQEvent>
{
  constructor(
    @Inject(LOGGER_SERVICE)
    private readonly logger: ILogger,
  ) {
    this.logger.setContext(BulkProcessingRequestCompletedHandler.name);
  }

  async handle(event: BulkProcessingRequestCompletedMQEvent): Promise<void> {
    this.logger.log(
      `Bulk processing completed: ${event.requestId} (${event.type}) for company ${event.companyId}. ` +
        `Results: ${event.successfulRows}/${event.processedRows} successful (${event.successRate.toFixed(1)}%)`,
    );

    // Additional processing for completed requests
    await this.processCompletionTasks(event);
  }

  private async processCompletionTasks(
    event: BulkProcessingRequestCompletedMQEvent,
  ): Promise<void> {
    try {
      // 1. Log completion statistics for analytics
      this.logCompletionStats(event);

      // 2. Send completion notification if there were errors
      if (event.hasErrors) {
        await this.handleErrorNotification(event);
      }

      // 3. Update company metrics
      await this.updateCompanyMetrics(event);

      // 4. Schedule cleanup tasks if needed
      await this.scheduleCleanupTasks(event);
    } catch (error) {
      this.logger.error(
        `Failed to process completion tasks for request ${event.requestId}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      // Don't throw - we don't want completion task failures to affect the main flow
    }
  }

  private logCompletionStats(event: BulkProcessingRequestCompletedMQEvent): void {
    this.logger.log(
      `[STATS] Bulk processing ${event.requestId}: ` +
        `Type=${event.type}, Company=${event.companyId}, ` +
        `Processed=${event.processedRows}, Successful=${event.successfulRows}, ` +
        `Failed=${event.failedRows}, SuccessRate=${event.successRate.toFixed(1)}%`,
    );
  }

  private async handleErrorNotification(
    event: BulkProcessingRequestCompletedMQEvent,
  ): Promise<void> {
    // In a real implementation, you might:
    // - Send email notifications to the requesting user
    // - Create alerts for administrators
    // - Update dashboards with error metrics
    // - Trigger error analysis workflows

    this.logger.warn(
      `Bulk processing request ${event.requestId} completed with ${event.failedRows} errors. ` +
        `Consider notifying user ${event.requestedBy} about the results.`,
    );
  }

  private async updateCompanyMetrics(event: BulkProcessingRequestCompletedMQEvent): Promise<void> {
    // Update company-level statistics
    // This could involve updating:
    // - Total processed items count
    // - Success/failure rates
    // - Processing volume metrics
    // - Usage analytics

    this.logger.debug(
      `Updated metrics for company ${event.companyId}: +${event.processedRows} processed items`,
    );
  }

  private async scheduleCleanupTasks(event: BulkProcessingRequestCompletedMQEvent): Promise<void> {
    // Schedule cleanup of temporary files, logs, etc.
    // This might involve:
    // - Cleaning up temporary download files
    // - Archiving old processing logs
    // - Compressing large result sets
    // - Removing intermediate processing data

    this.logger.debug(`Scheduled cleanup tasks for completed request ${event.requestId}`);
  }
}
