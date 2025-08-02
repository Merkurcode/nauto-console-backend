import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { USER_REPOSITORY, ROLE_REPOSITORY, COMPANY_REPOSITORY } from '@shared/constants/tokens';

// Controllers
import { UserController } from './user.controller';

// Repositories
import { UserRepository } from '@infrastructure/repositories/user.repository';
import { RoleRepository } from '@infrastructure/repositories/role.repository';
import { CompanyRepository } from '@infrastructure/repositories/company.repository';
import { PrismaModule } from '@infrastructure/database/prisma/prisma.module';
import { PrismaService } from '@infrastructure/database/prisma/prisma.service';
import { TransactionContextService } from '@infrastructure/database/prisma/transaction-context.service';
import { CoreModule } from '@core/core.module';
import { AuthModule } from '@presentation/modules/auth/auth.module';

// Services
import { UserService } from '@core/services/user.service';

// Query Handlers
import { GetUserQueryHandler } from '@application/queries/user/get-user.query';
import { GetUsersQueryHandler } from '@application/queries/user/get-users.query';

// Command Handlers
import { UpdateUserCommandHandler } from '@application/commands/user/update-user.command';
import { ChangePasswordCommandHandler } from '@application/commands/user/change-password.command';
import { ActivateUserCommandHandler } from '@application/commands/user/activate-user.command';
import { AssignRoleCommandHandler } from '@application/commands/user/assign-role.command';
import { RemoveRoleCommandHandler } from '@application/commands/user/remove-role.command';
import { VerifyPasswordCommandHandler } from '@application/commands/user/verify-password.command';

const queryHandlers = [GetUserQueryHandler, GetUsersQueryHandler];

const commandHandlers = [
  UpdateUserCommandHandler,
  ChangePasswordCommandHandler,
  ActivateUserCommandHandler,
  AssignRoleCommandHandler,
  RemoveRoleCommandHandler,
  VerifyPasswordCommandHandler,
];

@Module({
  imports: [CqrsModule, PrismaModule, CoreModule, AuthModule],
  controllers: [UserController],
  providers: [
    // Services
    {
      provide: UserService,
      useClass: UserService,
    },

    // Repository tokens
    {
      provide: USER_REPOSITORY,
      useFactory: (prisma: PrismaService, transactionContext: TransactionContextService) =>
        new UserRepository(prisma, transactionContext),
      inject: [PrismaService, TransactionContextService],
    },
    {
      provide: ROLE_REPOSITORY,
      useFactory: (prisma: PrismaService, transactionContext: TransactionContextService) =>
        new RoleRepository(prisma, transactionContext),
      inject: [PrismaService, TransactionContextService],
    },
    {
      provide: COMPANY_REPOSITORY,
      useFactory: (prisma: PrismaService, transactionContext: TransactionContextService) =>
        new CompanyRepository(prisma, transactionContext),
      inject: [PrismaService, TransactionContextService],
    },

    // Query handlers
    ...queryHandlers,

    // Command handlers
    ...commandHandlers,
  ],
  exports: [UserService],
})
export class UserModule {}
