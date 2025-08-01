import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';

// Controllers
import { RoleController } from './role.controller';

import { CoreModule } from '@core/core.module';
import { InfrastructureModule } from '@infrastructure/infrastructure.module';

// Services
import { RoleService } from '@core/services/role.service';
import { PermissionService } from '@core/services/permission.service';
import { PermissionExcludeService } from '@core/services/permission-exclude.service';

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
      useFactory: (prisma: PrismaService, transactionContext: TransactionContextService) =>
        new UserRepository(prisma, transactionContext),
      inject: [PrismaService, TransactionContextService],
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
