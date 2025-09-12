import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { BullModule } from '@nestjs/bullmq';

import { BulkProcessingRequestCompletedHandler } from './event-handlers/bulk-processing-request-completed.handler';
import { BulkProcessingRequestCreatedHandler } from './event-handlers/bulk-processing-request-created.handler';
import { BulkProcessingRequestFailedHandler } from './event-handlers/bulk-processing-request-failed.handler';
import { BulkProcessingProcessor } from './bulk-processing.processor';
import { BulkProcessingHandlerService } from './bulk-processing-handler.service';
import { BulkProcessingService } from '../../../core/services/bulk-processing.service';
import { ModuleConfig } from './bulk-processing-config';

const EventHandlers = [
  BulkProcessingRequestCompletedHandler,
  BulkProcessingRequestCreatedHandler,
  BulkProcessingRequestFailedHandler,
];

@Module({
  imports: [
    CqrsModule,
    BullModule.registerQueue({
      name: ModuleConfig.queue.name,
    }),
  ],
  providers: [
    ...EventHandlers,
    BulkProcessingService, // <-- Declare first since processor depends on it
    BulkProcessingProcessor,
    BulkProcessingHandlerService,
  ],
  exports: [
    ...EventHandlers,
    BulkProcessingProcessor,
    BulkProcessingHandlerService,
    BulkProcessingService,
  ],
})
export class BulkProcessingModule {}
