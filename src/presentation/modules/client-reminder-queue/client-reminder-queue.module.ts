import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { PrismaModule } from '@infrastructure/database/prisma/prisma.module';
import { CoreModule } from '@core/core.module';
import { InfrastructureModule } from '@infrastructure/infrastructure.module';

// Controller
import { ClientReminderQueueController } from './client-reminder-queue.controller';

// Services
import { ClientReminderQueueService } from '@core/services/client-reminder-queue.service';

// Repositories
import { ClientReminderQueueRepository } from '@infrastructure/repositories/client-reminder-queue.repository';

// Command Handlers
import { CreateClientReminderQueueCommandHandler } from '@application/commands/client-reminder-queue/create-client-reminder-queue.command';
import { UpdateClientReminderQueueCommandHandler } from '@application/commands/client-reminder-queue/update-client-reminder-queue.command';
import { ToggleQueueActiveCommandHandler } from '@application/commands/client-reminder-queue/toggle-queue-active.command';
import { DeleteClientReminderQueueCommandHandler } from '@application/commands/client-reminder-queue/delete-client-reminder-queue.command';

// Query Handlers
import { GetClientReminderQueuesQueryHandler } from '@application/queries/client-reminder-queue/get-client-reminder-queues.query';
import { GetClientReminderQueueQueryHandler } from '@application/queries/client-reminder-queue/get-client-reminder-queue.query';

const CommandHandlers = [
  CreateClientReminderQueueCommandHandler,
  UpdateClientReminderQueueCommandHandler,
  ToggleQueueActiveCommandHandler,
  DeleteClientReminderQueueCommandHandler,
];

const QueryHandlers = [GetClientReminderQueuesQueryHandler, GetClientReminderQueueQueryHandler];

const Services = [ClientReminderQueueService];

const Repositories = [
  {
    provide: 'IClientReminderQueueRepository',
    useClass: ClientReminderQueueRepository,
  },
  ClientReminderQueueRepository,
];

@Module({
  imports: [CqrsModule, PrismaModule, CoreModule, InfrastructureModule],
  controllers: [ClientReminderQueueController],
  providers: [...Services, ...Repositories, ...CommandHandlers, ...QueryHandlers],
  exports: [ClientReminderQueueService, 'IClientReminderQueueRepository'],
})
export class ClientReminderQueueModule {}
