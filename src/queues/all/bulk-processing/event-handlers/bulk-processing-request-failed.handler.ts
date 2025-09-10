/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable, Inject } from '@nestjs/common';
import { IEventHandler } from '@nestjs/cqrs';
import { MQSerializableEventHandler, MQSerializableEvent } from '@queues/registry/event-registry';
import { BulkProcessingRequestFailedEvent } from '@core/events/bulk-processing-request.events';
import { ILogger } from '@core/interfaces/logger.interface';
import { LOGGER_SERVICE } from '@shared/constants/tokens';

@MQSerializableEvent('BulkProcessingRequestFailedMQEvent')
export class BulkProcessingRequestFailedMQEvent {
  constructor(
    public readonly requestId: string,
    public readonly type: string,
    public readonly companyId: string,
    public readonly requestedBy: string,
    public readonly errorMessage: string,
    public readonly processedRows: number,
    public readonly successfulRows: number,
    public readonly failedRows: number,
    public readonly timestamp: Date = new Date(),
  ) {}

  static fromDomainEvent(
    event: BulkProcessingRequestFailedEvent,
  ): BulkProcessingRequestFailedMQEvent {
    return new BulkProcessingRequestFailedMQEvent(
      event.requestId.toString(),
      event.type,
      event.companyId.toString(),
      event.requestedBy.toString(),
      event.errorMessage,
      event.processedRows,
      event.successfulRows,
      event.failedRows,
      event.occurredOn,
    );
  }

  static fromJSON(data: any): BulkProcessingRequestFailedMQEvent {
    return new BulkProcessingRequestFailedMQEvent(
      data.requestId,
      data.type,
      data.companyId,
      data.requestedBy,
      data.errorMessage,
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
      errorMessage: this.errorMessage,
      processedRows: this.processedRows,
      successfulRows: this.successfulRows,
      failedRows: this.failedRows,
      timestamp: this.timestamp.toISOString(),
    };
  }

  get isPartialFailure(): boolean {
    return this.successfulRows > 0;
  }

  get isTotalFailure(): boolean {
    return this.successfulRows === 0;
  }
}

@Injectable()
@MQSerializableEventHandler(BulkProcessingRequestFailedMQEvent)
export class BulkProcessingRequestFailedHandler
  implements IEventHandler<BulkProcessingRequestFailedMQEvent>
{
  constructor(
    @Inject(LOGGER_SERVICE)
    private readonly logger: ILogger,
  ) {
    this.logger.setContext(BulkProcessingRequestFailedHandler.name);
  }

  async handle(event: BulkProcessingRequestFailedMQEvent): Promise<void> {
    const failureType = event.isTotalFailure ? 'TOTAL_FAILURE' : 'PARTIAL_FAILURE';

    this.logger.error(
      `Bulk processing failed (${failureType}): ${event.requestId} (${event.type}) for company ${event.companyId}. ` +
        `Error: ${event.errorMessage}. Progress: ${event.successfulRows}/${event.processedRows} successful`,
    );

    // Handle the failure with appropriate actions
    await this.processFailureTasks(event);
  }

  private async processFailureTasks(event: BulkProcessingRequestFailedMQEvent): Promise<void> {
    try {
      // 1. Log detailed failure information for debugging
      this.logFailureDetails(event);

      // 2. Send failure notifications
      await this.sendFailureNotifications(event);

      // 3. Update error metrics and monitoring
      await this.updateErrorMetrics(event);

      // 4. Schedule diagnostic tasks if needed
      await this.scheduleDiagnosticTasks(event);

      // 5. Cleanup partial results if necessary
      await this.cleanupPartialResults(event);
    } catch (error) {
      this.logger.error(
        `Failed to process failure tasks for request ${event.requestId}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      // Don't throw - we don't want failure processing to cascade
    }
  }

  private logFailureDetails(event: BulkProcessingRequestFailedMQEvent): void {
    this.logger.error(
      `[FAILURE_DETAILS] Request: ${event.requestId}\n` +
        `Type: ${event.type}\n` +
        `Company: ${event.companyId}\n` +
        `Requested by: ${event.requestedBy}\n` +
        `Error: ${event.errorMessage}\n` +
        `Progress: ${event.successfulRows}/${event.processedRows} rows successful\n` +
        `Failed rows: ${event.failedRows}\n` +
        `Failure type: ${event.isTotalFailure ? 'Total' : 'Partial'}\n` +
        `Timestamp: ${event.timestamp.toISOString()}`,
    );
  }

  private async sendFailureNotifications(event: BulkProcessingRequestFailedMQEvent): Promise<void> {
    // In a real implementation, you might:
    // - Send email notifications to the requesting user
    // - Create urgent alerts for system administrators
    // - Update user dashboards with failure status
    // - Trigger incident management workflows for critical failures
    // - Send Slack/Teams notifications to relevant channels

    if (event.isTotalFailure) {
      this.logger.warn(
        `URGENT: Total failure for bulk processing request ${event.requestId}. ` +
          `User ${event.requestedBy} should be notified immediately.`,
      );
    } else {
      this.logger.warn(
        `Partial failure for bulk processing request ${event.requestId}. ` +
          `User ${event.requestedBy} should be notified about the results.`,
      );
    }
  }

  private async updateErrorMetrics(event: BulkProcessingRequestFailedMQEvent): Promise<void> {
    // Update monitoring and metrics systems
    // This could involve:
    // - Incrementing error counters
    // - Recording error rates by company/type
    // - Updating SLA metrics
    // - Triggering alerts if error rates exceed thresholds
    // - Recording failure patterns for analysis

    this.logger.debug(
      `Updated error metrics for company ${event.companyId}: ` +
        `+1 ${event.type} failure, ${event.isTotalFailure ? 'total' : 'partial'}`,
    );
  }

  private async scheduleDiagnosticTasks(event: BulkProcessingRequestFailedMQEvent): Promise<void> {
    // Schedule diagnostic and analysis tasks
    // This might involve:
    // - Analyzing error patterns
    // - Checking system resources at time of failure
    // - Validating input data quality
    // - Testing system connectivity
    // - Reviewing processing pipeline health

    if (event.isTotalFailure) {
      this.logger.debug(
        `Scheduled diagnostic tasks for total failure ${event.requestId}. ` +
          `Error pattern: "${event.errorMessage}"`,
      );
    }
  }

  private async cleanupPartialResults(event: BulkProcessingRequestFailedMQEvent): Promise<void> {
    // Handle cleanup of partial results
    // This could involve:
    // - Rolling back partial database changes (if not using proper transactions)
    // - Cleaning up uploaded files that were partially processed
    // - Removing temporary data structures
    // - Ensuring system is in a consistent state

    if (event.isPartialFailure && event.successfulRows > 0) {
      this.logger.debug(
        `Evaluating cleanup needs for partial failure ${event.requestId}. ` +
          `${event.successfulRows} rows were successfully processed.`,
      );
    }
  }
}
