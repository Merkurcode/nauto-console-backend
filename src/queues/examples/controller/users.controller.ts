import { Controller, Post, Body } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { CreateUserCommand } from '../commands/create-user.command';
import { UseHealthGuard } from '../../guards/health.guard';

@Controller('users_test')
@UseHealthGuard('events') // Protege todo el controller con health check específico para la cola 'events'
export class UsersController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post()
  async createUser(@Body() dto: { email: string }) {
    const command = new CreateUserCommand(dto.email);
    const result = await this.commandBus.execute(command);

    return {
      ...result,
      meta: {
        timestamp: new Date().toISOString(),
      },
    };
  }
}
