import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { CoreModule } from '@core/core.module';
import { InfrastructureModule } from '@infrastructure/infrastructure.module';
import { BulkProcessingRequestCompletedHandler } from './event-handlers/bulk-processing-request-completed.handler';
import { BulkProcessingRequestCreatedHandler } from './event-handlers/bulk-processing-request-created.handler';
import { BulkProcessingRequestFailedHandler } from './event-handlers/bulk-processing-request-failed.handler';

const EventHandlers = [
  BulkProcessingRequestCompletedHandler,
  BulkProcessingRequestCreatedHandler,
  BulkProcessingRequestFailedHandler,
];

@Module({
  imports: [
    CqrsModule,
    CoreModule, // Para EmailService y SmsService, etc...
    InfrastructureModule, // Para otros servicios y configuración
  ],
  providers: [...EventHandlers],
  exports: [...EventHandlers],
})
export class BulkProcessingModule {}
