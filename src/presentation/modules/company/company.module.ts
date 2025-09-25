import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { CoreModule } from '@core/core.module';
import { InfrastructureModule } from '@infrastructure/infrastructure.module';
import { CompanyController } from './company.controller';
import { CompanyUsersController } from './company-users.controller';
import { CreateCompanyCommandHandler } from '@application/commands/company/create-company.command';
import { UpdateCompanyCommandHandler } from '@application/commands/company/update-company.command';
import { DeleteCompanyCommandHandler } from '@application/commands/company/delete-company.command';
import { DeactivateCompanyCommandHandler } from '@application/commands/company/deactivate-company.command';
import { AssignUserToCompanyCommandHandler } from '@application/commands/company/assign-user-to-company.command';
import { RemoveUserFromCompanyCommandHandler } from '@application/commands/company/remove-user-from-company.command';
import { SwitchCompanyCommandHandler } from '@application/commands/company/switch-company.command';
import { ExitCompanyCommandHandler } from '@application/commands/company/exit-company.command';
import { GetCompanyQueryHandler } from '@application/queries/company/get-company.query';
import { GetCompaniesQueryHandler } from '@application/queries/company/get-companies.query';
import { GetCompanyByHostQueryHandler } from '@application/queries/company/get-company-by-host.query';
import { GetCompanySubsidiariesQueryHandler } from '@application/queries/company/get-company-subsidiaries.query';
import { GetRootCompaniesQueryHandler } from '@application/queries/company/get-root-companies.query';
import { GetCompanyHierarchyQueryHandler } from '@application/queries/company/get-company-hierarchy.query';
// Repository tokens are provided by InfrastructureModule

const commandHandlers = [
  CreateCompanyCommandHandler,
  UpdateCompanyCommandHandler,
  DeleteCompanyCommandHandler,
  DeactivateCompanyCommandHandler,
  AssignUserToCompanyCommandHandler,
  RemoveUserFromCompanyCommandHandler,
  SwitchCompanyCommandHandler,
  ExitCompanyCommandHandler,
];

const queryHandlers = [
  GetCompanyQueryHandler,
  GetCompaniesQueryHandler,
  GetCompanyByHostQueryHandler,
  GetCompanySubsidiariesQueryHandler,
  GetRootCompaniesQueryHandler,
  GetCompanyHierarchyQueryHandler,
];

@Module({
  imports: [CqrsModule, CoreModule, InfrastructureModule],
  controllers: [CompanyController, CompanyUsersController],
  providers: [
    // Command and Query handlers
    ...commandHandlers,
    ...queryHandlers,
  ],
})
export class CompanyModule {}
