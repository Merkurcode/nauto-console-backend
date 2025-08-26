import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { StaleUploadsCleanupService } from './stale-uploads-cleanup.service';
import { StaleUploadsCleanupWorker } from './stale-uploads-cleanup.worker';
import { CoreModule } from '@core/core.module';

export const ModuleConfig = {
  queue: {
    name: 'stale-uploads-cleanup',
  },
} as const;

@Module({
  imports: [
    BullModule.registerQueue({
      name: ModuleConfig.queue.name,
      defaultJobOptions: {
        removeOnComplete: { age: 60 * 60, count: 100 }, // Keep last 100 for 1 hour
        removeOnFail: { age: 24 * 60 * 60, count: 100 }, // Keep last 100 for 24 hours
        attempts: 3,
        backoff: { type: 'exponential', delay: 30000 },
      },
    }),
    CoreModule,
  ],
  providers: [StaleUploadsCleanupService, StaleUploadsCleanupWorker],
  exports: [StaleUploadsCleanupService, StaleUploadsCleanupWorker],
})
export class StaleUploadsCleanupModule {}
