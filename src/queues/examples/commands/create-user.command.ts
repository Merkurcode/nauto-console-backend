import { CommandHandler, ICommand, ICommandHandler } from '@nestjs/cqrs';
import { ApiEventBusAdapter } from '../../all/events';
import { UserCreatedEvent } from '../event-handlers/user-created.handler';

export class CreateUserCommand implements ICommand {
  constructor(public readonly email: string) {}
}

@CommandHandler(CreateUserCommand)
export class CreateUserHandler implements ICommandHandler<CreateUserCommand> {
  constructor(private readonly eventBus: ApiEventBusAdapter) {}

  async execute(command: CreateUserCommand) {
    const userId = Math.random().toString(36).substring(7);

    console.warn(`[Command] Creating user: ${command.email}`);

    const event = new UserCreatedEvent(userId, command.email, new Date());
    await this.eventBus.publish(event);

    return { userId, email: command.email };
  }
}
