import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { PrismaModule } from '@infrastructure/database/prisma/prisma.module';
import { CoreModule } from '@core/core.module';
import { CompanyController } from './company.controller';
import { CompanyUsersController } from './company-users.controller';
import { CompanyRepository } from '@infrastructure/repositories/company.repository';
import { UserRepository } from '@infrastructure/repositories/user.repository';
import { TenantResolverService } from '@presentation/services/tenant-resolver.service';
import { CreateCompanyCommandHandler } from '@application/commands/company/create-company.command';
import { UpdateCompanyCommandHandler } from '@application/commands/company/update-company.command';
import { DeleteCompanyCommandHandler } from '@application/commands/company/delete-company.command';
import { AssignUserToCompanyCommandHandler } from '@application/commands/company/assign-user-to-company.command';
import { RemoveUserFromCompanyCommandHandler } from '@application/commands/company/remove-user-from-company.command';
import { GetCompanyQueryHandler } from '@application/queries/company/get-company.query';
import { GetCompaniesQueryHandler } from '@application/queries/company/get-companies.query';
import { GetCompanyByHostQueryHandler } from '@application/queries/company/get-company-by-host.query';
import { REPOSITORY_TOKENS } from '@shared/constants/tokens';

const commandHandlers = [
  CreateCompanyCommandHandler,
  UpdateCompanyCommandHandler,
  DeleteCompanyCommandHandler,
  AssignUserToCompanyCommandHandler,
  RemoveUserFromCompanyCommandHandler,
];

const queryHandlers = [
  GetCompanyQueryHandler,
  GetCompaniesQueryHandler,
  GetCompanyByHostQueryHandler,
];

@Module({
  imports: [CqrsModule, PrismaModule, CoreModule],
  controllers: [CompanyController, CompanyUsersController],
  providers: [
    {
      provide: REPOSITORY_TOKENS.COMPANY_REPOSITORY,
      useClass: CompanyRepository,
    },
    {
      provide: REPOSITORY_TOKENS.USER_REPOSITORY,
      useClass: UserRepository,
    },
    TenantResolverService,
    ...commandHandlers,
    ...queryHandlers,
  ],
  exports: [REPOSITORY_TOKENS.COMPANY_REPOSITORY, TenantResolverService],
})
export class CompanyModule {}
