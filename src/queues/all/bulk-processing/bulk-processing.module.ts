import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { BullModule } from '@nestjs/bullmq';

import { BulkProcessingProcessor } from './bulk-processing.processor';
import { BulkProcessingHandlerService } from './bulk-processing-handler.service';
import { BulkProcessingService } from '../../../core/services/bulk-processing.service';
import { ModuleConfig } from './bulk-processing-config';

@Module({
  imports: [
    CqrsModule,
    BullModule.registerQueue({
      name: ModuleConfig.queue.name,
    }),
  ],
  providers: [
    BulkProcessingService, // <-- Declare first since processor depends on it
    BulkProcessingProcessor,
    BulkProcessingHandlerService,
  ],
  exports: [BulkProcessingProcessor, BulkProcessingHandlerService, BulkProcessingService],
})
export class BulkProcessingModule {}
