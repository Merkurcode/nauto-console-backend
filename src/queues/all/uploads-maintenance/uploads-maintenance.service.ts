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
    // Programa un job repetible cada 5 minutos
    await this.queue.add(
      'cleanup-active-users',
      { scanCount: 500, maxMs: 4000 },
      {
        jobId: 'uploads-maint:cleanup-active-users', // <- clave
        repeat: { every: 5 * 60 * 1000 },
        removeOnComplete: { age: 60 * 60, count: 1000 },
        removeOnFail: { age: 24 * 60 * 60, count: 1000 },
        attempts: 1,
      },
    );

    this.logger.log('Repeatable job "cleanup-active-users" programado cada 5m');
  }
}
