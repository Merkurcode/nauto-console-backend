import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { PrismaModule } from '@infrastructure/database/prisma/prisma.module';
import { CoreModule } from '@core/core.module';
import { CompanyController } from './company.controller';
import { CompanyRepository } from '@infrastructure/repositories/company.repository';
import { TenantResolverService } from '@presentation/services/tenant-resolver.service';
import { CreateCompanyCommandHandler } from '@application/commands/company/create-company.command';
import { UpdateCompanyCommandHandler } from '@application/commands/company/update-company.command';
import { DeleteCompanyCommandHandler } from '@application/commands/company/delete-company.command';
import { GetCompanyQueryHandler } from '@application/queries/company/get-company.query';
import { GetCompaniesQueryHandler } from '@application/queries/company/get-companies.query';
import { GetCompanyByHostQueryHandler } from '@application/queries/company/get-company-by-host.query';
import { REPOSITORY_TOKENS } from '@shared/constants/tokens';

const commandHandlers = [
  CreateCompanyCommandHandler,
  UpdateCompanyCommandHandler,
  DeleteCompanyCommandHandler,
];

const queryHandlers = [
  GetCompanyQueryHandler,
  GetCompaniesQueryHandler,
  GetCompanyByHostQueryHandler,
];

@Module({
  imports: [CqrsModule, PrismaModule, CoreModule],
  controllers: [CompanyController],
  providers: [
    {
      provide: REPOSITORY_TOKENS.COMPANY_REPOSITORY,
      useClass: CompanyRepository,
    },
    TenantResolverService,
    ...commandHandlers,
    ...queryHandlers,
  ],
  exports: [REPOSITORY_TOKENS.COMPANY_REPOSITORY, TenantResolverService],
})
export class CompanyModule {}
