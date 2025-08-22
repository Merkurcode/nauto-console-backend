import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { UploadsMaintenanceService } from './uploads-maintenance.service';
import { UploadsMaintenanceWorker } from './uploads-maintenance.worker';
import { InfrastructureModule } from '@infrastructure/infrastructure.module';

export const ModuleConfig = {
  queue: {
    name: 'uploads-maint',
  },
} as const;

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'uploads-maint',
    }),
    InfrastructureModule,
  ],
  providers: [UploadsMaintenanceService, UploadsMaintenanceWorker],
  exports: [UploadsMaintenanceService],
})
export class UploadsMaintenanceModule {}
