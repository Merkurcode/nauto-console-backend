import { Inject, Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ModuleConfig } from './event-config';
import { GenericEventBus } from 'src/queues/event-bus/generic-event-bus';
import { HealthService } from 'src/queues/health/health-checker.service';
import { ILogger } from '@core/interfaces/logger.interface';
import { LOGGER_SERVICE } from '@shared/constants/tokens';
import { IPublishOptions } from 'src/queues/types';

@Injectable()
export class ApiEventBusAdapter extends GenericEventBus {
  constructor(
    @InjectQueue(ModuleConfig.queue.name) eventsQueue: Queue,
    @Inject(LOGGER_SERVICE) logger: ILogger,
    @Inject() healthService: HealthService,
  ) {
    super(eventsQueue, ModuleConfig, logger, healthService);
  }

  /**
   * Override para aceptar cualquier tipo de objeto
   */
  async publish<T extends object>(
    event: T,
    opts?: IPublishOptions,
  ): Promise<{ jobId: string; status: 'queued' }> {
    return super.publish(event as Record<string, unknown>, opts);
  }

  async publishAll<T extends object>(
    events: T[],
    opts?: IPublishOptions,
  ): Promise<{ jobIds: string[]; status: 'queued' }> {
    return super.publishBatch(events as Record<string, unknown>[], opts);
  }

  publishFast<T extends object>(event: T): void {
    super.publishFast(event as Record<string, unknown>);
  }
}
