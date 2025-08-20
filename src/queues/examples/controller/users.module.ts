import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { CreateUserHandler } from '../commands/create-user.command';
import { UserCreatedHandler } from '../event-handlers/user-created.handler';
import { UsersController } from './users.controller';

const CommandHandlers = [CreateUserHandler];
const EventHandlers = [UserCreatedHandler];

@Module({
  imports: [CqrsModule],
  controllers: [UsersController],
  providers: [...CommandHandlers, ...EventHandlers],
  exports: [...EventHandlers],
})
export class UsersModuleQueuesTest {}
