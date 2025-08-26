import { Injectable, OnModuleInit, Inject } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ILogger } from '@core/interfaces/logger.interface';
import { LOGGER_SERVICE } from '@shared/constants/tokens';

@Injectable()
export class StaleUploadsCleanupService implements OnModuleInit {
  constructor(
    @InjectQueue('stale-uploads-cleanup') private readonly queue: Queue,
    @Inject(LOGGER_SERVICE) private readonly logger: ILogger,
  ) {
    this.logger.setContext(StaleUploadsCleanupService.name);
  }

  async onModuleInit() {
    // Schedule a repeatable job every 10 minutes
    await this.queue.add(
      'cleanup-stale-uploads',
      { inactivityThresholdMinutes: 15 }, // Clean uploads inactive for 15+ minutes
      {
        jobId: 'stale-uploads-cleanup:cleanup-stale-uploads',
        repeat: { every: 10 * 60 * 1000 }, // Every 10 minutes
        removeOnComplete: { age: 60 * 60, count: 100 },
        removeOnFail: { age: 24 * 60 * 60, count: 100 },
        attempts: 3,
        backoff: { type: 'exponential', delay: 30000 },
      },
    );

    this.logger.log('Repeatable job "cleanup-stale-uploads" scheduled every 10m');
  }
}
