import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { InfrastructureModule } from '@infrastructure/infrastructure.module';
import { CoreModule } from '@core/core.module';

// Controllers
import { CompanyEventsCatalogController } from './company-events-catalog.controller';

// Commands
import { CreateCompanyEventHandler } from '@application/commands/company-events-catalog/create-company-event.command';
import { UpdateCompanyEventHandler } from '@application/commands/company-events-catalog/update-company-event.command';
import { DeleteCompanyEventHandler } from '@application/commands/company-events-catalog/delete-company-event.command';

// Queries
import { GetCompanyEventsHandler } from '@application/queries/company-events-catalog/get-company-events.query';
import { GetCompanyEventByNameHandler } from '@application/queries/company-events-catalog/get-company-event-by-name.query';

// Mappers
import { CompanyEventsCatalogMapper } from '@application/mappers/company-events-catalog.mapper';

@Module({
  imports: [CqrsModule, InfrastructureModule, CoreModule],
  controllers: [CompanyEventsCatalogController],
  providers: [
    // Command Handlers
    CreateCompanyEventHandler,
    UpdateCompanyEventHandler,
    DeleteCompanyEventHandler,

    // Query Handlers
    GetCompanyEventsHandler,
    GetCompanyEventByNameHandler,

    // Mappers
    CompanyEventsCatalogMapper,
  ],
})
export class CompanyEventsCatalogModule {}
