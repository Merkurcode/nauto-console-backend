import { IEventHandler } from '@nestjs/cqrs';
import { Job } from 'bullmq';
import { EventRegistry, HandlerRegistry } from '../registry/event-registry';
import { BaseProcessor } from '../base/base-processor';
import { IEventJobData, IHandlerProgress, IQueueModuleConfig } from '../types';
import { ILogger } from '@core/interfaces/logger.interface';

export class GenericEventProcessor extends BaseProcessor<IEventJobData> {
  protected eventHandlers: IEventHandler[] = [];

  constructor(module: IQueueModuleConfig, logger: ILogger) {
    super(module, logger);
  }

  async processJob(job: Job<IEventJobData>): Promise<void> {
    const { eventName, payload } = job.data ?? {};
    if (!eventName || typeof eventName !== 'string') {
      throw new Error('InvalidJob: eventName is required');
    }

    // Check for invalid event names that should be discarded
    if (eventName === 'Array' || eventName === 'Object' || eventName.trim() === '') {
      this.logger.warn(`Discarding job ${job.id} with invalid event name: ${eventName}`);
      await job.discard();

      return;
    }

    try {
      var instance = EventRegistry.deserializeEvent(eventName, payload);
    } catch (error) {
      // If event deserialization fails due to missing constructor, discard the job
      if (error.message.includes('Event constructor not found')) {
        this.logger.warn(
          `Discarding job ${job.id} with unregistered event: ${eventName}. Error: ${error.message}`,
        );
        await job.discard();

        return;
      }
      // Re-throw other errors for normal retry logic
      throw error;
    }

    await this.executeHandlers(instance, job);
  }

  private async executeHandlers(event: object, job: Job<IEventJobData>): Promise<void> {
    const eventConstructor = event?.constructor as { __eventName?: string; name?: string };
    const eventName = eventConstructor?.__eventName || eventConstructor?.name || 'Event';
    const classes = HandlerRegistry.getHandlersForEvent(eventName);
    const selected: IEventHandler[] = [];
    const prevProgress = (job.progress as IHandlerProgress) ?? { doneHandlers: [] };
    const doneHandlers = new Set<string>(
      Array.isArray(prevProgress.doneHandlers) ? prevProgress.doneHandlers : [],
    );

    for (const cls of classes) {
      const inst = this.eventHandlers?.find(h => h.constructor === cls);
      if (inst && !doneHandlers.has(inst.constructor.name)) selected.push(inst);
    }

    if (!selected.length) {
      this.logger.warn(`No handlers for ${eventName}`);

      return;
    }

    const errors: Error[] = [];
    for (const handler of selected) {
      try {
        await handler.handle(event);
        doneHandlers.add(handler.constructor.name);
        await job.updateProgress({ doneHandlers: Array.from(doneHandlers) } as IHandlerProgress);
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error(String(error)));
        continue;
      }
    }

    if (errors.length > 0) {
      const errorMessages = errors.map(err => err.message).join('; ');
      throw new Error(`Handler failures: ${errorMessages}`);
    }
  }
}
