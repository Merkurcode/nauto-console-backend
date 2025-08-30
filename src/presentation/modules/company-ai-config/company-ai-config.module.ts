import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { CompanyAIConfigController } from './company-ai-config.controller';
import { CreateCompanyAIConfigHandler } from '@application/commands/company-ai-config/create-company-ai-config.command';
import { UpdateCompanyAIConfigHandler } from '@application/commands/company-ai-config/update-company-ai-config.command';
import { DeleteCompanyAIConfigHandler } from '@application/commands/company-ai-config/delete-company-ai-config.command';
import { GetCompanyAIConfigHandler } from '@application/queries/company-ai-config/get-company-ai-config.query';
import { CoreModule } from '@core/core.module';
import { PrismaModule } from '@infrastructure/database/prisma/prisma.module';
import { InfrastructureModule } from '@infrastructure/infrastructure.module';

/**
 * Company AI Configuration Module
 * Following Clean Architecture: Presentation layer module for HTTP concerns
 */
@Module({
  imports: [
    CqrsModule,
    CoreModule, // For CompanyService
    PrismaModule, // For TransactionService
    InfrastructureModule, // For CompanyRepository
  ],
  controllers: [CompanyAIConfigController],
  providers: [
    // Command handlers
    CreateCompanyAIConfigHandler,
    UpdateCompanyAIConfigHandler,
    DeleteCompanyAIConfigHandler,

    // Query handlers
    GetCompanyAIConfigHandler,
  ],
})
export class CompanyAIConfigModule {}
