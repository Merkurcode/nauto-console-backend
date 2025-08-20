import { Processor, OnWorkerEvent } from '@nestjs/bullmq';
import { IEventHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { Job } from 'bullmq';
import { ModuleConfig } from './event-config';
import { GenericEventProcessor } from 'src/queues/processors/generic-event-processor';
import { LOGGER_SERVICE } from '@shared/constants/tokens';
import { ILogger } from '@core/interfaces/logger.interface';
import { IEventJobData } from 'src/queues/types';

@Processor(ModuleConfig.queue.name, ModuleConfig.processor)
export class EventProcessor extends GenericEventProcessor {
  constructor(
    @Inject('EVENT_HANDLERS') eventHandlers: IEventHandler[],
    @Inject(LOGGER_SERVICE) logger: ILogger,
  ) {
    super(ModuleConfig, logger);
    this.eventHandlers = eventHandlers;
  }

  // Implementar los decoradores para que BullMQ los reconozca
  @OnWorkerEvent('failed')
  async onFailed(job: Job<IEventJobData> | undefined, err: Error) {
    await this.handleFailedJob(job, err);
  }

  @OnWorkerEvent('completed')
  async onCompleted(job: Job<IEventJobData>) {
    await this.handleCompletedJob(job);
  }

  @OnWorkerEvent('stalled')
  async onStalled(job: Job<IEventJobData>) {
    await this.handleStalledJob(job);
  }

  @OnWorkerEvent('error')
  async onWorkerError(err: Error) {
    await this.handleWorkerError(err);
  }
}
