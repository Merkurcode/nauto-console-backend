import { Injectable, Inject } from '@nestjs/common';
import { Queue } from 'bullmq';
import { validateEvent } from '../validation/event-validation';
import { BaseEventBus } from '../base/base-event-bus';
import { IQueueModuleConfig, IEventJobData, IPublishOptions } from '../types';
import { HealthService } from '../health/health-checker.service';
import { ILogger } from '@core/interfaces/logger.interface';
import { LOGGER_SERVICE } from '@shared/constants/tokens';

@Injectable()
export class GenericEventBus extends BaseEventBus<Record<string, unknown>> {
  constructor(
    queue: Queue,
    module: IQueueModuleConfig,
    @Inject(LOGGER_SERVICE) logger: ILogger,
    healthService?: HealthService,
  ) {
    super(module, queue, logger, healthService);
  }

  protected getJobName(event: Record<string, unknown>): string {
    // Validate that the event is a proper object, not an array
    if (Array.isArray(event)) {
      throw new Error('Cannot publish Array as event. Events must be objects with proper event structure.');
    }

    const evt = event as Record<string, unknown> & {
      constructor?: { __eventName?: string; name?: string };
    };

    const eventName = (
      (evt.__eventName as string) ||
      evt.constructor?.__eventName ||
      (evt.eventName as string) ||
      (evt.type as string) ||
      (evt.name as string) ||
      evt.constructor?.name ||
      'Event'
    );

    // Additional validation for problematic event names
    if (eventName === 'Array' || eventName === 'Object') {
      throw new Error(`Invalid event name "${eventName}". Event objects must have a proper __eventName, eventType, type, or name property.`);
    }

    return eventName;
  }

  protected prepareJobData(event: Record<string, any>, jobId: string): IEventJobData {
    const eventName = this.getJobName(event);
    const eventWithName = { ...event, __eventName: eventName } as Record<string, unknown>;

    validateEvent(eventWithName);

    const now = Date.now();
    const retryUntil = now + (this.module.queue.retryWindowMs || 6 * 60 * 60 * 1000);

    return {
      eventName,
      payload: eventWithName as Record<string, unknown>,
      eventId: jobId,
      timestamp: now,
      retryUntil,
    };
  }

  async publishEvent<T extends Record<string, any>>(
    event: T,
    opts?: IPublishOptions,
  ): Promise<{ jobId: string; status: 'queued' }> {
    return this.publish(event, opts);
  }

  async publishEvents<T extends Record<string, any>>(
    events: T[],
    opts?: IPublishOptions,
  ): Promise<{ jobIds: string[]; status: 'queued' }> {
    return this.publishBatch(events, opts);
  }

  publishEventFast<T extends Record<string, any>>(event: T): void {
    this.publishFast(event);
  }
}
