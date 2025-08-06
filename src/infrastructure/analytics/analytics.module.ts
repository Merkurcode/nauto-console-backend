import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma/prisma.module';
import { UniversalKPIEngine } from './universal-kpi-engine.service';
import { AppointmentAnalyticsService } from './appointment-analytics.service';
import { KPIManagementService } from './kpi-management.service';
import { AnalyticsJobsService } from './analytics-jobs.service';

@Module({
  imports: [PrismaModule],
  providers: [
    UniversalKPIEngine,
    AppointmentAnalyticsService,
    KPIManagementService,
    AnalyticsJobsService,
  ],
  exports: [
    UniversalKPIEngine,
    AppointmentAnalyticsService,
    KPIManagementService,
    AnalyticsJobsService,
  ],
})
export class AnalyticsModule {}
