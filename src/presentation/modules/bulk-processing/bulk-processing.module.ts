import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { CoreModule } from '@core/core.module';
import { InfrastructureModule } from '@infrastructure/infrastructure.module';

// Controllers
import { BulkProcessingController } from './bulk-processing.controller';

// Commands
import { CreateBulkProcessingRequestHandler } from '@application/commands/bulk-processing/create-bulk-processing-request.command';
import { StartBulkProcessingHandler } from '@application/commands/bulk-processing/start-bulk-processing.command';
import { CancelBulkProcessingHandler } from '@application/commands/bulk-processing/cancel-bulk-processing.command';

// Queries
import { GetBulkProcessingRequestHandler } from '@application/queries/bulk-processing/get-bulk-processing-request.query';
import { GetBulkProcessingRequestsByCompanyHandler } from '@application/queries/bulk-processing/get-bulk-processing-requests-by-company.query';
import { GetBulkProcessingErrorReportHandler } from '@application/queries/bulk-processing/get-bulk-processing-error-report.query';
import { GetBulkProcessingWarningReportHandler } from '@application/queries/bulk-processing/get-bulk-processing-warning-report.query';
import { GetBulkProcessingJobStatusHandler } from '@application/queries/bulk-processing/get-bulk-processing-job-status.query';

// Queue Integration
import { BulkProcessingModule as QueueBulkProcessingModule } from '@queues/all/bulk-processing/bulk-processing.module';
import { BulkProcessingTypeGuard } from '@shared/constants/bulk-processing-type.enum';

const CommandHandlers = [
  CreateBulkProcessingRequestHandler,
  StartBulkProcessingHandler,
  CancelBulkProcessingHandler,
];

const QueryHandlers = [
  GetBulkProcessingRequestHandler,
  GetBulkProcessingRequestsByCompanyHandler,
  GetBulkProcessingErrorReportHandler,
  GetBulkProcessingWarningReportHandler,
  GetBulkProcessingJobStatusHandler,
];

@Module({
  imports: [
    CqrsModule,
    CoreModule,
    InfrastructureModule,
    QueueBulkProcessingModule, // Import the queue module
  ],
  controllers: [BulkProcessingController],
  providers: [...CommandHandlers, ...QueryHandlers, BulkProcessingTypeGuard],
  exports: [
    // Export queue module for use in other modules
    QueueBulkProcessingModule,
  ],
})
export class BulkProcessingModule {}
