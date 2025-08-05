import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsModule as InfraAnalyticsModule } from '../../../infrastructure/analytics/analytics.module';

@Module({
  imports: [InfraAnalyticsModule],
  controllers: [AnalyticsController],
})
export class AnalyticsModule {}
