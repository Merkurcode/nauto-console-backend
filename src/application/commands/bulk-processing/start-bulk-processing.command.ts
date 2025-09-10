import { ICommand, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { IBulkProcessingRequestRepository } from '@core/repositories/bulk-processing-request.repository.interface';
import { IFileRepository } from '@core/repositories/file.repository.interface';
import {
  BULK_PROCESSING_REQUEST_REPOSITORY,
  LOGGER_SERVICE,
  FILE_REPOSITORY,
} from '@shared/constants/tokens';
import {
  BulkProcessingRequestNotFoundException,
  UnauthorizedBulkProcessingRequestAccessException,
  BulkProcessingInvalidStatusException,
  BulkProcessingFileNotFoundException,
  BulkProcessingInvalidFileStatusException,
} from '@core/exceptions/bulk-processing.exceptions';
import { ILogger } from '@core/interfaces/logger.interface';
import { BulkProcessingEventBus } from '@queues/all/bulk-processing/bulk-processing-event-bus';
import { FileLockService } from '@core/services/file-lock.service';
import { FileStatus } from '@shared/constants/file-status.enum';
import {
  BulkProcessingEventType,
  BulkProcessingTypeGuard,
} from '@shared/constants/bulk-processing-type.enum';
import { BulkProcessingOptionsDto } from '@application/dtos/bulk-processing/start-bulk-processing.dto';
import { IBulkProcessingFlatOptions } from '@core/interfaces/bulk-processing-options.interface';
import { IJwtPayload } from '@application/dtos/_responses/user/user.response';

export class StartBulkProcessingCommand implements ICommand {
  constructor(
    public readonly jwtPayload: IJwtPayload,
    public readonly requestId: string,
    public readonly companyId: string,
    public readonly userId: string,
    public readonly eventType: BulkProcessingEventType,
    public readonly options?: BulkProcessingOptionsDto,
    public readonly priority?: number,
  ) {}
}

@CommandHandler(StartBulkProcessingCommand)
export class StartBulkProcessingHandler
  implements ICommandHandler<StartBulkProcessingCommand, { jobId: string; status: string }>
{
  constructor(
    @Inject(BULK_PROCESSING_REQUEST_REPOSITORY)
    private readonly bulkProcessingRequestRepository: IBulkProcessingRequestRepository,
    @Inject(FILE_REPOSITORY)
    private readonly fileRepository: IFileRepository,
    @Inject(LOGGER_SERVICE)
    private readonly logger: ILogger,
    private readonly bulkProcessingEventBus: BulkProcessingEventBus,
    private readonly fileLockService: FileLockService,
    @Inject(BulkProcessingTypeGuard)
    private readonly bulkProcessingTypeGuard: BulkProcessingTypeGuard,
  ) {
    this.logger.setContext(StartBulkProcessingHandler.name);
  }

  async execute(command: StartBulkProcessingCommand): Promise<{ jobId: string; status: string }> {
    const { requestId, companyId, userId, eventType, options, priority, jwtPayload } = command;

    this.bulkProcessingTypeGuard.canAccessEventType(eventType, jwtPayload, 'write');

    // Convert structured options to flat format for backward compatibility
    const flatOptions = this.flattenOptions(options);

    // Get the bulk processing request first to obtain fileId
    let bulkRequest = await this.bulkProcessingRequestRepository.findByIdAndCompany(
      requestId,
      companyId,
    );

    if (!bulkRequest) {
      throw new BulkProcessingRequestNotFoundException(requestId);
    }

    if (this.bulkProcessingTypeGuard.isReservedType(bulkRequest.type)) {
      throw new UnauthorizedBulkProcessingRequestAccessException(bulkRequest.type, requestId);
    }

    // Verify user has access
    if (!bulkRequest.belongsToCompany(companyId)) {
      throw new UnauthorizedBulkProcessingRequestAccessException(requestId, companyId);
    }

    // Use file lock to ensure exclusive access during processing start
    return this.fileLockService.withFileLock(
      bulkRequest.fileId.toString(),
      async () => {
        // Refresh for latest status
        bulkRequest = await this.bulkProcessingRequestRepository.findByIdAndCompany(
          requestId,
          companyId,
        );

        // Validate request can be started
        if (
          bulkRequest.isInProgress() ||
          bulkRequest.isCompleted() ||
          (bulkRequest.isPending() && bulkRequest.jobId)
        ) {
          throw new BulkProcessingInvalidStatusException(
            requestId,
            bulkRequest.isPending() && bulkRequest.jobId ? 'STARTED' : bulkRequest.status,
            'started',
          );
        }

        this.logger.log(`🔍 Starting file validation for request ${requestId}`);

        // Get the associated file and verify it's in UPLOADED status
        const file = await this.fileRepository.findById(bulkRequest.fileId.toString());
        if (!file) {
          this.logger.error(
            `❌ File not found for request ${requestId}: ${bulkRequest.fileId.toString()}`,
          );
          throw new BulkProcessingFileNotFoundException(requestId, bulkRequest.fileId.toString());
        }

        this.logger.log(
          `📁 File found for request ${requestId}. Status: ${file.status.getValue()}`,
        );

        // Only accept jobs if the file is in UPLOADED status
        if (!file.status.isUploaded()) {
          this.logger.error(
            `❌ File not in UPLOADED status for request ${requestId}. Current: ${file.status.getValue()}, Required: ${FileStatus.UPLOADED}`,
          );
          throw new BulkProcessingInvalidFileStatusException(
            bulkRequest.fileId.toString(),
            file.status.getValue(),
            FileStatus.UPLOADED,
          );
        }

        this.logger.log(
          `✅ File validation passed for request ${requestId}. Proceeding to mark as PROCESSING`,
        );

        // Mark file as PROCESSING and store original status for potential rollback
        file.markAsProcessing();
        await this.fileRepository.update(file);

        // Store original status in bulk request metadata for potential rollback
        const newMetadata = {
          ...bulkRequest.metadata,
          originalFileStatus: FileStatus.UPLOADED, // We verified it was UPLOADED above
          fileMarkedAsProcessingAt: new Date().toISOString(),
        };

        this.logger.log(
          `Updating metadata for bulk request ${requestId}. Old metadata: ${JSON.stringify(bulkRequest.metadata)}, New metadata: ${JSON.stringify(newMetadata)}`,
        );

        bulkRequest.updateMetadata(newMetadata);
        await this.bulkProcessingRequestRepository.update(bulkRequest);

        this.logger.log(
          `Metadata updated and committed for bulk request ${requestId}. Current metadata: ${JSON.stringify(bulkRequest.metadata)}`,
        );

        this.logger.log(
          `Marked file ${file.id} as ${FileStatus.PROCESSING} for bulk processing request ${requestId} by: ${userId}`,
        );

        // Queue the processing job based on type
        const jobId = `${bulkRequest.type}-${Date.now()}-${crypto.randomUUID()}`;
        let jobResult: { jobId: string; status: string } = { jobId, status: 'queued' };

        // Update the bulk request with the jobId
        bulkRequest.setJobId(jobId);
        await this.bulkProcessingRequestRepository.update(bulkRequest);

        this.logger.log(`Generating new job ${jobId} for bulk request ${requestId}`);

        switch (bulkRequest.type) {
          default:
            // For extensibility - use generic processing
            jobResult = await this.bulkProcessingEventBus.queueGenericBulkJob(
              bulkRequest.type,
              {
                requestId,
                eventType,
                fileId: bulkRequest.fileId.toString(),
                fileName: bulkRequest.fileName,
                companyId,
                userId,
                options: flatOptions as IBulkProcessingFlatOptions,
                metadata: {
                  requestType: bulkRequest.type,
                  eventType,
                  requestedBy: bulkRequest.requestedBy.toString(),
                  createdAt: bulkRequest.createdAt.toISOString(),
                },
              },
              {
                priority: priority || 10,
                removeOnComplete: 10,
                removeOnFail: 50,
                jobId,
              },
            );
            break;
        }

        if (jobResult.status !== 'queued') {
          this.logger.error(
            `Could not add new job ${jobId} to the queue for request: ${requestId}, by: ${userId}`,
          );
          throw new Error('Could not add a new job to the queue.');
        }

        this.logger.log(
          `Started bulk processing job: ${jobResult.jobId} for request: ${requestId} ` +
            `(type: ${bulkRequest.type}, company: ${companyId}, by: ${userId})`,
        );

        return jobResult;
      },
      60000, // 60 seconds timeout for lock (bulk processing can take time to start)
      {
        acquireTimeoutMs: 60000, // Wait up to 10 seconds to acquire the lock
        retryDelayMs: 200, // Retry every 200ms
      },
    );
  }

  /**
   * Flattens the structured options into a flat object for backward compatibility
   */
  private flattenOptions(options?: BulkProcessingOptionsDto): IBulkProcessingFlatOptions {
    this.logger.log(`Flattening options: ${JSON.stringify(options, null, 2)}`);

    if (!options) {
      this.logger.log('No options provided, returning empty object');

      return {};
    }

    const flat: IBulkProcessingFlatOptions = {};

    // Media processing options
    if (options.mediaProcessing) {
      flat.skipMediaDownload = options.mediaProcessing.skipMediaDownload;
      flat.continueOnMediaError = options.mediaProcessing.continueOnMediaError;
      flat.maxMediaConcurrency = options.mediaProcessing.maxMediaConcurrency;
      flat.mediaDownloadTimeout = options.mediaProcessing.mediaDownloadTimeout;
      flat.validateMediaExtensions = options.mediaProcessing.validateMediaExtensions;
    }

    // Validation options
    if (options.validation) {
      flat.skipValidation = options.validation.skipValidation;
      flat.continueOnValidationError = options.validation.continueOnValidationError;
      flat.treatWarningsAsErrors = options.validation.treatWarningsAsErrors;
      flat.maxStoredErrors = options.validation.maxStoredErrors;
      flat.maxStoredWarnings = options.validation.maxStoredWarnings;
    }

    // Parsing options
    if (options.parsing) {
      flat.startRow = options.parsing.startRow;
      flat.skipEmptyRows = options.parsing.skipEmptyRows;
      flat.trimValues = options.parsing.trimValues;
      flat.sheetName = options.parsing.sheetName;
    }

    // Processing behavior
    if (options.processing) {
      flat.stopOnFirstError = options.processing.stopOnFirstError;
      flat.dryRun = options.processing.dryRun;
    }

    // Metadata
    if (options.metadata) {
      flat.metadata = options.metadata;
    }

    this.logger.log(`Flattened options result: ${JSON.stringify(flat, null, 2)}`);

    return flat;
  }
}
