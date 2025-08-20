// General
import { Processor } from '@nestjs/bullmq';
import { IEventHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { Job } from 'bullmq';
import { GenericEventProcessor } from 'src/queues/processors/generic-event-processor';
import { LOGGER_SERVICE } from '@shared/constants/tokens';
import { ILogger } from '@core/interfaces/logger.interface';
import { IEventJobData } from 'src/queues/types';

import { ModuleConfig } from './email-config';

@Processor(ModuleConfig.queue.name, ModuleConfig.processor)
export class AuthEmailEventProcessor extends GenericEventProcessor {
  constructor(
    @Inject('EVENT_HANDLERS') eventHandlers: IEventHandler[],
    @Inject(LOGGER_SERVICE) logger: ILogger,
  ) {
    super(ModuleConfig, logger);
    this.eventHandlers = eventHandlers;
  }

  async onFailed(job: Job<IEventJobData> | undefined, err: Error) {
    await this.handleFailedJob(job, err);
  }

  async onCompleted(job: Job<IEventJobData>) {
    await this.handleCompletedJob(job);
  }

  async onStalled(job: Job<IEventJobData>) {
    await this.handleStalledJob(job);
  }

  async onWorkerError(err: Error) {
    await this.handleWorkerError(err);
  }
}
