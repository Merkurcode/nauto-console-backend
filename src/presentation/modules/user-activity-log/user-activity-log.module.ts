import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { CoreModule } from '@core/core.module';
import { UserActivityLogController } from './user-activity-log.controller';
import { GetUserActivityLogsQueryHandler } from '@application/queries/user-activity-log/get-user-activity-logs.query';

const QueryHandlers = [GetUserActivityLogsQueryHandler];

@Module({
  imports: [CqrsModule, CoreModule],
  controllers: [UserActivityLogController],
  providers: [...QueryHandlers],
  exports: [...QueryHandlers],
})
export class UserActivityLogModule {}
