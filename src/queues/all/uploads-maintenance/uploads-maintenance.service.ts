import { Injectable, OnModuleInit, Inject } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ILogger } from '@core/interfaces/logger.interface';
import { LOGGER_SERVICE } from '@shared/constants/tokens';

@Injectable()
export class UploadsMaintenanceService implements OnModuleInit {
  constructor(
    @InjectQueue('uploads-maint') private readonly queue: Queue,
    @Inject(LOGGER_SERVICE) private readonly logger: ILogger,
  ) {
    this.logger.setContext(UploadsMaintenanceService.name);
  }

  async onModuleInit() {
    // Get configurable values with Render-optimized defaults
    const intervalMinutes = parseInt(process.env.UPLOADS_MAINTENANCE_INTERVAL_MIN || '5', 10);
    const scanCount = parseInt(process.env.UPLOADS_MAINTENANCE_SCAN_COUNT || '500', 10);
    const maxMs = parseInt(process.env.UPLOADS_MAINTENANCE_MAX_MS || '4000', 10);
    const attempts = parseInt(process.env.UPLOADS_MAINTENANCE_ATTEMPTS || '1', 10);

    // Programa un job repetible con configuraciones optimizadas para Render
    await this.queue.add(
      'cleanup-active-users',
      { scanCount, maxMs },
      {
        jobId: 'uploads-maint:cleanup-active-users', // <- clave
        repeat: { every: intervalMinutes * 60 * 1000 }, // Configurable interval
        // TTL-based cleanup optimized for Render deployment
        removeOnComplete: {
          age: 3 * 60 * 60, // Keep completed jobs for 3 hours (in seconds)
          count: 100, // Keep max 100 completed jobs (memory optimization)
        },
        removeOnFail: {
          age: 12 * 60 * 60, // Keep failed jobs for 12 hours (in seconds)
          count: 50, // Keep max 50 failed jobs (memory optimization)
        },
        attempts,
        backoff: { type: 'exponential', delay: 10000 }, // Added backoff for failures
        priority: 3, // Low priority maintenance task
      },
    );

    this.logger.log(
      `Repeatable job "cleanup-active-users" programado cada ${intervalMinutes}m (scan: ${scanCount}, maxMs: ${maxMs})`,
    );
  }
}
