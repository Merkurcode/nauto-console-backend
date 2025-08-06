import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { InfrastructureModule } from '@infrastructure/infrastructure.module';
import { CoreModule } from '@core/core.module';

// Controllers
import { CompanySchedulesController } from './company-schedules.controller';

// Commands
import { CreateCompanyScheduleHandler } from '@application/commands/company-schedules/create-company-schedule.command';
import { UpdateCompanyScheduleHandler } from '@application/commands/company-schedules/update-company-schedule.command';
import { DeleteCompanyScheduleHandler } from '@application/commands/company-schedules/delete-company-schedule.command';

// Queries
import { GetCompanySchedulesHandler } from '@application/queries/company-schedules/get-company-schedules.query';
import { GetCompanyWeeklyScheduleHandler } from '@application/queries/company-schedules/get-company-weekly-schedule.query';

// Mappers
import { CompanySchedulesMapper } from '@application/mappers/company-schedules.mapper';

@Module({
  imports: [CqrsModule, InfrastructureModule, CoreModule],
  controllers: [CompanySchedulesController],
  providers: [
    // Command Handlers
    CreateCompanyScheduleHandler,
    UpdateCompanyScheduleHandler,
    DeleteCompanyScheduleHandler,

    // Query Handlers
    GetCompanySchedulesHandler,
    GetCompanyWeeklyScheduleHandler,

    // Mappers
    CompanySchedulesMapper,
  ],
})
export class CompanySchedulesModule {}
