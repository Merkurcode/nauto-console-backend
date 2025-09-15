import { PartialType } from '@nestjs/swagger';
import { CreateClientReminderQueueDto } from './create-client-reminder-queue.dto';

export class UpdateClientReminderQueueDto extends PartialType(CreateClientReminderQueueDto) {}
