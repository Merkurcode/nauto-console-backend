import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
// Repository tokens are provided by InfrastructureModule

// Controllers
import { UserController } from './user.controller';

import { CoreModule } from '@core/core.module';
import { InfrastructureModule } from '@infrastructure/infrastructure.module';
import { AuthModule } from '@presentation/modules/auth/auth.module';

// Services
import { UserService } from '@core/services/user.service';

// Query Handlers
import { GetUserQueryHandler } from '@application/queries/user/get-user.query';
import { GetUsersQueryHandler } from '@application/queries/user/get-users.query';
import { GetUserWithAuthorizationQueryHandler } from '@application/queries/user/get-user-with-authorization.query';
import { SearchUsersQueryHandler } from '@application/queries/user/search-users.query';

// Command Handlers
import { UpdateUserCommandHandler } from '@application/commands/user/update-user.command';
import { ChangePasswordCommandHandler } from '@application/commands/user/change-password.command';
import { ActivateUserCommandHandler } from '@application/commands/user/activate-user.command';
import { AssignRoleCommandHandler } from '@application/commands/user/assign-role.command';
import { RemoveRoleCommandHandler } from '@application/commands/user/remove-role.command';
import { VerifyPasswordCommandHandler } from '@application/commands/user/verify-password.command';
import { UpdateUserProfileCommandHandler } from '@application/commands/user/update-user-profile.command';
import { DeleteUserCommandHandler } from '@application/commands/user/delete-user.command';

const queryHandlers = [
  GetUserQueryHandler,
  GetUsersQueryHandler,
  GetUserWithAuthorizationQueryHandler,
  SearchUsersQueryHandler,
];

const commandHandlers = [
  UpdateUserCommandHandler,
  ChangePasswordCommandHandler,
  ActivateUserCommandHandler,
  AssignRoleCommandHandler,
  RemoveRoleCommandHandler,
  VerifyPasswordCommandHandler,
  UpdateUserProfileCommandHandler,
  DeleteUserCommandHandler,
];

@Module({
  imports: [CqrsModule, CoreModule, InfrastructureModule, AuthModule],
  controllers: [UserController],
  providers: [
    // Services (from CoreModule)
    UserService,

    // Query handlers
    ...queryHandlers,

    // Command handlers
    ...commandHandlers,
  ],
  exports: [UserService],
})
export class UserModule {}
