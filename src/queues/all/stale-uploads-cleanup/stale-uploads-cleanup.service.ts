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
    // Get configurable values with Render-optimized defaults
    const intervalMinutes = parseInt(process.env.STALE_UPLOADS_CLEANUP_INTERVAL_MIN || '10', 10);
    const inactivityThreshold = parseInt(
      process.env.STALE_UPLOADS_INACTIVITY_THRESHOLD_MIN || '15',
      10,
    );
    const attempts = parseInt(process.env.STALE_UPLOADS_CLEANUP_ATTEMPTS || '3', 10);

    // Schedule a repeatable job with Render-optimized settings
    await this.queue.add(
      'cleanup-stale-uploads',
      { inactivityThresholdMinutes: inactivityThreshold },
      {
        jobId: 'stale-uploads-cleanup:cleanup-stale-uploads',
        repeat: { every: intervalMinutes * 60 * 1000 }, // Configurable interval
        // TTL-based cleanup optimized for Render deployment
        removeOnComplete: {
          age: 6 * 60 * 60, // Keep completed jobs for 6 hours (in seconds)
          count: 50, // Keep max 50 completed jobs (memory optimization)
        },
        removeOnFail: {
          age: 24 * 60 * 60, // Keep failed jobs for 24 hours (in seconds)
          count: 20, // Keep max 20 failed jobs (memory optimization)
        },
        attempts,
        backoff: { type: 'exponential', delay: 30000 },
        priority: 5, // Low priority background task
      },
    );

    this.logger.log(
      `Repeatable job "cleanup-stale-uploads" scheduled every ${intervalMinutes}m (threshold: ${inactivityThreshold}m)`,
    );
  }
}
