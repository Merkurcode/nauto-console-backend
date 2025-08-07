import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

// Controllers
import { RoleController } from './role.controller';

import { CoreModule } from '@core/core.module';
import { InfrastructureModule } from '@infrastructure/infrastructure.module';

// Repository imports
import { PrismaService } from '@infrastructure/database/prisma/prisma.service';
import { TransactionContextService } from '@infrastructure/database/prisma/transaction-context.service';
import { RoleRepository } from '@infrastructure/repositories/role.repository';
import { PermissionRepository } from '@infrastructure/repositories/permission.repository';
import { UserRepository } from '@infrastructure/repositories/user.repository';
import { REPOSITORY_TOKENS, USER_REPOSITORY } from '@shared/constants/tokens';

// Services
import { RoleService } from '@core/services/role.service';
import { PermissionService } from '@core/services/permission.service';
import { PermissionExcludeService } from '@core/services/permission-exclude.service';
import { BusinessConfigurationService } from '@core/services/business-configuration.service';

// Query Handlers
import { GetRolesQueryHandler } from '@application/queries/role/get-roles.query';
import { GetRoleQueryHandler } from '@application/queries/role/get-role.query';
import { GetAssignablePermissionsQueryHandler } from '@application/queries/permission/get-assignable-permissions.query';
import { GetPermissionsForTargetRoleQueryHandler } from '@application/queries/permission/get-permissions-for-target-role.query';
import { GetCurrentUserPermissionsQueryHandler } from '@application/queries/permission/get-current-user-permissions.query';

// Command Handlers
import { CreateRoleCommandHandler } from '@application/commands/role/create-role.command';
import { UpdateRoleCommandHandler } from '@application/commands/role/update-role.command';
import { DeleteRoleCommandHandler } from '@application/commands/role/delete-role.command';
import { AssignPermissionCommandHandler } from '@application/commands/role/assign-permission.command';
import { RemovePermissionCommandHandler } from '@application/commands/role/remove-permission.command';

const queryHandlers = [
  GetRolesQueryHandler,
  GetRoleQueryHandler,
  GetAssignablePermissionsQueryHandler,
  GetPermissionsForTargetRoleQueryHandler,
  GetCurrentUserPermissionsQueryHandler,
];

const commandHandlers = [
  CreateRoleCommandHandler,
  UpdateRoleCommandHandler,
  DeleteRoleCommandHandler,
  AssignPermissionCommandHandler,
  RemovePermissionCommandHandler,
];

@Module({
  imports: [CqrsModule, CoreModule, InfrastructureModule],
  controllers: [RoleController],
  providers: [
    // Services (from CoreModule)
    RoleService,
    PermissionService,
    PermissionExcludeService,

    // Repository tokens
    {
      provide: REPOSITORY_TOKENS.ROLE_REPOSITORY,
      useFactory: (prisma: PrismaService, transactionContext: TransactionContextService) =>
        new RoleRepository(prisma, transactionContext),
      inject: [PrismaService, TransactionContextService],
    },
    {
      provide: REPOSITORY_TOKENS.PERMISSION_REPOSITORY,
      useFactory: (prisma: PrismaService, transactionContext: TransactionContextService) =>
        new PermissionRepository(prisma, transactionContext),
      inject: [PrismaService, TransactionContextService],
    },
    {
      provide: REPOSITORY_TOKENS.USER_REPOSITORY,
      useFactory: (
        prisma: PrismaService,
        transactionContext: TransactionContextService,
        businessConfigService: BusinessConfigurationService,
      ) => new UserRepository(prisma, transactionContext, businessConfigService),
      inject: [PrismaService, TransactionContextService, BusinessConfigurationService],
    },
    {
      provide: USER_REPOSITORY,
      useClass: UserRepository,
    },
    {
      provide: USER_REPOSITORY,
      useClass: UserRepository,
    },
    {
      provide: USER_REPOSITORY,
      useClass: UserRepository,
    },
    {
      provide: USER_REPOSITORY,
      useClass: UserRepository,
    },
    {
      provide: USER_REPOSITORY,
      useClass: UserRepository,
    },
    {
      provide: USER_REPOSITORY,
      useClass: UserRepository,
    },
    {
      provide: USER_REPOSITORY,
      useClass: UserRepository,
    },
    {
      provide: USER_REPOSITORY,
      useClass: UserRepository,
    },
    {
      provide: USER_REPOSITORY,
      useClass: UserRepository,
    },
    {
      provide: USER_REPOSITORY,
      useClass: UserRepository,
    },
    {
      provide: USER_REPOSITORY,
      useClass: UserRepository,
    },

    // Query handlers
    ...queryHandlers,

    // Command handlers
    ...commandHandlers,
  ],
})
export class RoleModule {}
