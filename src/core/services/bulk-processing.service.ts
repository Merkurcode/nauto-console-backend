import { Injectable } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ConfigService } from '@nestjs/config';
import { Job, Queue } from 'bullmq';
import { ILogger } from '@core/interfaces/logger.interface';
import { IStorageService } from '@core/repositories/storage.service.interface';
import { IFileRepository } from '@core/repositories/file.repository.interface';
import { IBulkProcessingRequestRepository } from '@core/repositories/bulk-processing-request.repository.interface';
import { IProductCatalogRepository } from '@core/repositories/product-catalog.repository.interface';
import { FileDownloadStreamingService } from '@core/services/file-download-streaming.service';
import { UserStorageConfigService } from '@core/services/user-storage-config.service';
import { EntityNotFoundException } from '@core/exceptions/domain-exceptions';
import { BulkProcessingRequestNotFoundException } from '@core/exceptions/bulk-processing.exceptions';
import { ExcelStreamingService, IExcelRowProcessor } from '@core/services/excel-streaming.service';
import { FileStatus } from '@shared/constants/file-status.enum';
import { ProcessorHub } from '@queues/all/bulk-processing/processors/processors-hub';
import {
  BulkProcessingEventType,
  BulkProcessingType,
} from '@shared/constants/bulk-processing-type.enum';
import { IBulkProcessingFlatOptions } from '@core/interfaces/bulk-processing-options.interface';
import { BulkProcessingRequest } from '@core/entities/bulk-processing-request.entity';
import { FileLockService } from '@core/services/file-lock.service';
import { BulkProcessingEventBus } from '@queues/all/bulk-processing/bulk-processing-event-bus';
import { LoggerService } from '@infrastructure/logger/logger.service';
import { FileRepository } from '@infrastructure/repositories/file.repository';
import { PrismaService } from '@infrastructure/database/prisma/prisma.service';
import { TransactionContextService } from '@infrastructure/database/prisma/transaction-context.service';
import { BulkProcessingRequestRepository } from '@infrastructure/repositories/bulk-processing-request.repository';
import { ProductCatalogRepository } from '@infrastructure/repositories/product-catalog.repository';
import { UserStorageConfigRepository } from '@infrastructure/repositories/user-storage-config.repository';
import { ConcurrencyService } from '@infrastructure/services/concurrency.service';
import { RedisConnectionFactory } from '@infrastructure/redis/redis-connection-factory';
import { InjectQueue } from '@nestjs/bullmq';
import { ModuleConfig } from '@queues/all/bulk-processing';
import { StorageProviderFactory } from '@infrastructure/storage/storage-provider.factory';

// ====== Contextos ======

export interface IBulkProcessingContext {
  requestId: string;
  eventType: BulkProcessingEventType;
  fileId: string;
  fileName: string;
  companyId: string;
  userId: string;
  options: IBulkProcessingFlatOptions;
  metadata?: Record<string, unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  job?: Job<any>;
  cancellationChecker?: () => Promise<void>;
}

@Injectable()
export class BulkProcessingService {
  private readonly logger: ILogger;
  private readonly storageService: IStorageService;
  private readonly fileRepository: IFileRepository;
  private readonly bulkProcessingRequestRepository: IBulkProcessingRequestRepository;
  private readonly productCatalogRepository: IProductCatalogRepository;
  private readonly excelStreamingService: ExcelStreamingService;
  private readonly fileDownloadService: FileDownloadStreamingService;
  private readonly userStorageConfigService: UserStorageConfigService;
  private readonly fileLockService: FileLockService;
  private readonly bulkProcessingEventBus: BulkProcessingEventBus;

  constructor(
    @InjectQueue(ModuleConfig.queue.name) queue: Queue,
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly configService: ConfigService,
    private readonly transactionContext: TransactionContextService,
    private readonly prismaService: PrismaService,
  ) {
    this.bulkProcessingEventBus = new BulkProcessingEventBus(
      queue,
      new LoggerService(this.configService),
    );
    this.userStorageConfigService = new UserStorageConfigService(
      new UserStorageConfigRepository(
        this.prismaService,
        this.transactionContext,
        new LoggerService(this.configService),
      ),
    );
    this.fileLockService = new FileLockService(
      new ConcurrencyService(
        new RedisConnectionFactory(
          this.configService,
          new LoggerService(this.configService),
        ).createConnection('storage-concurrency', {
          // Configuración específica para storage operations
          db: 0, // Database dedicada para storage
        }),
        new LoggerService(this.configService),
      ),
      new LoggerService(this.configService),
    );
    this.excelStreamingService = new ExcelStreamingService(
      new LoggerService(this.configService),
      this.configService,
      this.userStorageConfigService,
    );
    this.logger = new LoggerService(this.configService);
    this.storageService = StorageProviderFactory.create(
      this.configService,
      new LoggerService(this.configService),
    );
    this.fileDownloadService = new FileDownloadStreamingService(
      new LoggerService(this.configService),
      this.storageService,
      this.configService,
      this.queryBus,
    );
    this.fileRepository = new FileRepository(
      this.prismaService,
      this.transactionContext,
      this.configService,
      new LoggerService(this.configService),
    );
    this.bulkProcessingRequestRepository = new BulkProcessingRequestRepository(
      this.prismaService,
      this.transactionContext,
      new LoggerService(this.configService),
    );
    this.productCatalogRepository = new ProductCatalogRepository(
      this.prismaService,
      this.transactionContext,
      new LoggerService(this.configService),
    );
    this.logger.setContext(BulkProcessingService.name);
  }

  // ====== Entrada genérica ======

  async processExcelFile(context: IBulkProcessingContext): Promise<void> {
    const { requestId, eventType, options } = context;

    this.logger.log(
      `BulkProcessingService: Processing Excel file with context options: ${JSON.stringify(options, null, 2)}`,
    );

    const bulkRequest: BulkProcessingRequest =
      await this.bulkProcessingRequestRepository.findByIdAndCompany(requestId, context.companyId);
    if (!bulkRequest) throw new BulkProcessingRequestNotFoundException(requestId);

    let processor: IExcelRowProcessor | undefined;

    try {
      const file = await this.fileRepository.findById(context.fileId);
      if (!file) throw new EntityNotFoundException('File', context.fileId);

      // S3 → stream (NO convertir a buffer)
      const objectStream = await this.storageService.getObjectStream(
        file.bucket,
        file.getObjectKeyString(),
      );

      // Processor por tipo de evento
      processor = await ProcessorHub.createProcessorForEventType(
        this.fileRepository,
        this.bulkProcessingRequestRepository,
        this.fileDownloadService,
        this.commandBus,
        this.queryBus,
        this.configService,
        this.userStorageConfigService,
        this.logger,
        eventType,
        context,
        bulkRequest,
        this.storageService,
        this.productCatalogRepository,
        this.bulkProcessingEventBus,
      );

      // Opciones de parseo (mapping de columnas)
      const parsingOptions = processor.getParsingOptionsForEventType(eventType, context);

      // Let processor control initialization
      if (processor.onBeforeProcessing) {
        await processor.onBeforeProcessing(context);
      }

      // Get processor configuration for delegation decisions
      const stateConfig = processor.getStateManagementConfig();

      // Custom progress updates if processor handles them
      if (stateConfig.handlesProgressUpdates && processor.getProgressUpdate && context.job) {
        const initialProgress = processor.getProgressUpdate('start', 0);
        await context.job.updateProgress(initialProgress);
      } else if (context.job) {
        // Fallback to default 5% if processor doesn't handle progress
        await context.job.updateProgress(5);
      }

      this.logger.log(`Start Excel streaming for request ${requestId}`);

      // Procesado streaming real
      const result = await this.excelStreamingService.processExcelStream(
        objectStream, // Readable
        parsingOptions,
        processor,
        context,
      );

      this.logger.log(
        `Excel done for ${requestId}: ${result.processedRows}/${result.totalRows}, ` +
          `${result.successfulRows} ok, ${result.failedRows} fail`,
      );

      // Set the logs and update counters
      await processor.setLogs(bulkRequest, result);

      // Always delegate completion to processor if it handles completion
      if (stateConfig.handlesCompletion && processor.onProcessingComplete) {
        this.logger.log(`Delegating completion control to processor for ${requestId}`);
        await processor.onProcessingComplete(result);
      } else if (!stateConfig.handlesCompletion) {
        // Use service completion only if processor explicitly doesn't handle it
        this.logger.log(
          `Processor doesn't handle completion, using service completion for ${requestId}`,
        );
        bulkRequest.complete(
          result.totalRows > 0 ? result.totalRows : bulkRequest.totalRows || undefined,
        );
        await this.bulkProcessingRequestRepository.update(bulkRequest);

        // Update progress to 100% for service-controlled completion
        if (context?.job) {
          await context.job.updateProgress(100);
        }

        this.logger.log(`Bulk processing completed via service for ${requestId}`);
        await this.markFileAsErasingAndScheduleCleanup(context);
      } else {
        // Processor handles completion but doesn't implement the method - this is a configuration error
        this.logger.error(
          `Configuration error: Processor claims to handle completion but doesn't implement onProcessingComplete for ${requestId}`,
        );
        throw new Error(
          `Processor configuration error: handlesCompletion=true but onProcessingComplete method not implemented`,
        );
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Bulk processing failed for ${requestId}: ${msg}`);

      // Get the latest state to check if it was cancelled or should be failed
      const latestBulkRequest = await this.bulkProcessingRequestRepository.findByIdAndCompany(
        requestId,
        context.companyId,
      );
      if (latestBulkRequest) {
        // Only delegate to processor if it was successfully created
        if (processor) {
          // Delegate error handling to processor if it handles error states
          const stateConfig = processor.getStateManagementConfig();

          if (stateConfig.handlesErrorStates && processor.onProcessingFailed) {
            this.logger.log(`Delegating failure handling to processor for ${requestId}`);
            await processor.onProcessingFailed(
              error instanceof Error ? error : new Error(String(error)),
              context,
            );
          } else {
            // Fallback: service handles error states
            if (
              !latestBulkRequest.isCompleted() &&
              !latestBulkRequest.isCancelled() &&
              !latestBulkRequest.hasFailed()
            ) {
              if (latestBulkRequest.isCancelling()) {
                // Don't mark as failed if it's being cancelled - let the cancellation process handle it
                this.logger.log(`Request ${requestId} is being cancelled, not marking as failed`);
              } else {
                // Mark as failed only if it's not being cancelled
                if (!stateConfig.handlesFileStatusRestoration) {
                  await this.restoreFileStatusAfterProcessing(latestBulkRequest, 'failed');
                }
                latestBulkRequest.fail(msg);
                await this.bulkProcessingRequestRepository.update(latestBulkRequest);
              }
            } else {
              this.logger.warn(
                `Request ${requestId} already in final state: ${latestBulkRequest.status}, not changing status`,
              );
            }
          }
        } else {
          // Processor creation failed - use basic service error handling
          this.logger.log(
            `Processor not available, using basic service error handling for ${requestId}`,
          );
          if (
            !latestBulkRequest.isCompleted() &&
            !latestBulkRequest.isCancelled() &&
            !latestBulkRequest.hasFailed()
          ) {
            if (latestBulkRequest.isCancelling()) {
              this.logger.log(`Request ${requestId} is being cancelled, not marking as failed`);
            } else {
              await this.restoreFileStatusAfterProcessing(latestBulkRequest, 'failed');
              latestBulkRequest.fail(msg);
              await this.bulkProcessingRequestRepository.update(latestBulkRequest);
            }
          } else {
            this.logger.warn(
              `Request ${requestId} already in final state: ${latestBulkRequest.status}, not changing status`,
            );
          }
        }
      }

      throw error;
    }
  }

  /** * Cleanup temporary files */
  async cleanupTempFiles(data: {
    requestId: string;
    companyId: string;
    userId: string;
    filesToCleanup: string[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    job?: Job<any>;
    //cancellationChecker?: () => Promise<void>;
  }): Promise<void> {
    const { requestId, filesToCleanup } = data;

    this.logger.log(`Starting cleanup for request ${requestId}: ${filesToCleanup.length} files`);

    let cleanedCount = 0;
    for (const fileId of filesToCleanup) {
      // Check for cancellation before each file cleanup
      //await data?.cancellationChecker?.();

      try {
        // Get file information from database using fileId
        const file = await this.fileRepository.findById(fileId);

        if (!file) {
          this.logger.debug(`File not found in database for cleanup: ${fileId}`);
          continue;
        }

        // Get file storage information
        const bucket = file.bucket;
        const objectKey = file.getObjectKeyString();

        // Check if file exists in storage before attempting delete
        const exists = await this.storageService.objectExists(bucket, objectKey);
        if (exists) {
          await this.storageService.deleteObject(bucket, objectKey);
          cleanedCount++;
          this.logger.debug(`Cleaned up file: ${bucket}/${objectKey} (${fileId})`);
        } else {
          this.logger.debug(
            `File not found in storage for cleanup: ${bucket}/${objectKey} (${fileId})`,
          );
        }

        await this.fileRepository.delete(fileId);
      } catch (error) {
        this.logger.warn(
          `Failed to cleanup file ${fileId}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    this.logger.log(
      `Cleanup completed for request ${requestId}: ${cleanedCount}/${filesToCleanup.length} files cleaned`,
    );
  }

  // ====== Procesador por evento ======

  private async markFileAsErasingAndScheduleCleanup(
    context: IBulkProcessingContext,
  ): Promise<void> {
    try {
      const filesToCleanup: string[] = [];

      // Mark file as erasing and add to cleanup list
      if (context.fileId) {
        // Get the file from database
        const file = await this.fileRepository.findById(context.fileId);

        if (file) {
          // Mark as erasing
          file.markAsErasing();

          // Update in database
          await this.fileRepository.update(file);

          // Add to cleanup list
          filesToCleanup.push(context.fileId);

          this.logger.log(
            `Marked file ${context.fileId} as ERASING for request ${context.requestId}`,
          );
        } else {
          this.logger.warn(
            `File ${context.fileId} not found for marking as erasing in request ${context.requestId}`,
          );
        }
      }

      // Schedule cleanup job with the event bus if there are files to clean
      if (filesToCleanup.length > 0) {
        this.logger.log(
          `Attempting to schedule cleanup job for request ${context.requestId} with ${filesToCleanup.length} files`,
        );

        const result = await this.bulkProcessingEventBus.queueCleanupJob(
          {
            requestId: context.requestId,
            fileId: context.fileId || context.requestId,
            companyId: context.companyId,
            userId: context.userId,
            filesToCleanup,
            metadata: {
              eventType: context.eventType,
              scheduledAt: new Date().toISOString(),
            },
          },
          {
            delay: 0, // No delay for testing
            attempts: 2,
            removeOnComplete: 5,
            removeOnFail: 3,
          },
        );

        this.logger.log(
          `✅ Scheduled cleanup job ${result.jobId} for request ${context.requestId} with ${filesToCleanup.length} files - will execute immediately`,
        );
      } else {
        this.logger.debug(`No files to schedule for cleanup in request ${context.requestId}`);
      }
    } catch (error) {
      this.logger.error(
        `Failed to mark file as erasing and schedule cleanup for request ${context.requestId}: ${error?.message || error}`,
      );
    }
  }

  private async restoreFileStatusAfterProcessing(
    bulkRequest: BulkProcessingRequest,
    reason: string,
  ): Promise<void> {
    const latest = await this.bulkProcessingRequestRepository.findByIdAndCompany(
      bulkRequest.id.getValue(),
      bulkRequest.companyId.getValue(),
    );
    if (!latest) {
      this.logger.error(`Bulk request ${bulkRequest.id} not found on restore`);

      return;
    }

    this.logger.log(
      `Restoring file status for bulk request ${bulkRequest.id}. Latest metadata from DB: ${JSON.stringify(latest.metadata)}`,
    );

    const original = latest.metadata?.originalFileStatus;
    if (!original) {
      this.logger.warn(
        `No original file status for bulk request ${bulkRequest.id}. Full metadata: ${JSON.stringify(latest.metadata)}`,
      );

      return;
    }

    try {
      const file = await this.fileRepository.findById(bulkRequest.fileId.toString());
      if (!file) {
        this.logger.error(`File not found on restore for bulk request ${bulkRequest.id}`);

        return;
      }
      if (file.status.isProcessing()) {
        if (original === FileStatus.UPLOADED) {
          file.markAsUploaded();
          await this.fileRepository.update(file);
          this.logger.log(`Restored file ${file.id} to ${original} after ${reason}`);
        } else {
          this.logger.warn(`Unexpected original status "${original}" for ${file.id}`);
        }
      }
    } catch (e) {
      this.logger.error(
        `Restore file status failed for ${bulkRequest.id} after ${reason}: ${e?.message || e}`,
      );
    }
  }

  async handleJobFailure(data: {
    requestId: string;
    companyId: string;
    fileId: string;
    error: string;
    jobType: string;
  }): Promise<void> {
    const { requestId, companyId, error: errMsg } = data;
    try {
      const br = await this.bulkProcessingRequestRepository.findByIdAndCompany(
        requestId,
        companyId,
      );
      if (!br) {
        this.logger.warn(`Bulk request not found on failure cleanup: ${requestId}`);

        return;
      }
      await this.restoreFileStatusAfterProcessing(br, 'job failed');
      if (!br.hasFailed() && !br.isCompleted()) {
        br.fail(`Job failure: ${errMsg}`);
        await this.bulkProcessingRequestRepository.update(br);
      }
      this.logger.log(`Failure cleanup done for ${requestId}`);
    } catch (e) {
      this.logger.error(`Failure cleanup failed for ${requestId}: ${e?.message || e}`);
    }
  }

  async handleJobCancellation(data: {
    requestId: string;
    companyId: string;
    fileId: string;
    jobType: BulkProcessingType;
    eventType: BulkProcessingEventType;
  }): Promise<void> {
    const { requestId, companyId, fileId, eventType } = data;

    try {
      const bulkRequest = await this.bulkProcessingRequestRepository.findByIdAndCompany(
        requestId,
        companyId,
      );
      if (!bulkRequest) {
        this.logger.warn(`Bulk request not found on cancellation cleanup: ${requestId}`);

        return;
      }

      // First create the context needed for processor creation
      const context: IBulkProcessingContext = {
        requestId,
        eventType,
        fileId,
        fileName: bulkRequest.fileName || '',
        companyId,
        userId: bulkRequest.requestedBy.getValue(),
        options: {}, // TODO: Extract from metadata if needed
        metadata: bulkRequest.metadata,
      };

      const processor = await ProcessorHub.createProcessorForEventType(
        this.fileRepository,
        this.bulkProcessingRequestRepository,
        this.fileDownloadService,
        this.commandBus,
        this.queryBus,
        this.configService,
        this.userStorageConfigService,
        this.logger,
        eventType,
        context,
        bulkRequest,
        this.storageService,
        this.productCatalogRepository,
        this.bulkProcessingEventBus,
      );
      if (processor && typeof processor.onProcessingCancelled === 'function') {
        try {
          await processor.onProcessingCancelled(context);
          this.logger.log(`Processor-specific cancellation cleanup completed for ${requestId}`);
        } catch (error) {
          this.logger.error(
            `Processor cancellation cleanup failed for ${requestId}: ${error?.message || error}`,
            error?.stack,
          );
        }
      }

      // Restore file status if it was marked as PROCESSING
      const originalFileStatus = bulkRequest.metadata?.originalFileStatus;
      if (originalFileStatus) {
        try {
          // Use file lock to ensure exclusive access during status restoration
          await this.fileLockService.withFileLock(
            fileId,
            async () => {
              const file = await this.fileRepository.findById(fileId);
              if (file && file.status.isProcessing()) {
                // Restore to original status (which should be UPLOADED based on our validation)
                if (originalFileStatus === FileStatus.UPLOADED) {
                  file.markAsUploaded();
                  await this.fileRepository.update(file);
                  this.logger.log(
                    `Restored file ${file.id} from ${FileStatus.PROCESSING} to ${originalFileStatus} ` +
                      `for cancelled bulk processing request ${requestId}`,
                  );
                }
              }
            },
            30000, // 30 seconds timeout for lock
            {
              acquireTimeoutMs: 30000, // Wait up to 5 seconds to acquire the lock
              retryDelayMs: 100, // Retry every 100ms
            },
          );
        } catch (error) {
          // Log error but continue with cancellation
          this.logger.error(
            `Failed to restore file status for cancelled bulk processing request ${requestId}: ${error?.message || error}. ` +
              `File may remain in ${FileStatus.PROCESSING} state and require manual intervention.`,
          );
        }
      }

      // Complete the cancellation (transition from CANCELLING to CANCELLED)
      if (bulkRequest.isCancelling()) {
        bulkRequest.cancel();
        await this.bulkProcessingRequestRepository.update(bulkRequest);
        this.logger.log(
          `Successfully completed cancellation for bulk processing request: ${requestId}`,
        );
      } else {
        this.logger.warn(
          `Bulk processing request ${requestId} is not in CANCELLING state, current status: ${bulkRequest.status}`,
        );
      }
    } catch (e) {
      this.logger.error(`Cancellation cleanup failed for ${requestId}: ${e?.message || e}`);
    }
  }

  async handleJobStalled(data: {
    requestId: string;
    companyId: string;
    fileId: string;
    jobType: string;
  }): Promise<void> {
    const { requestId, companyId } = data;
    try {
      const br = await this.bulkProcessingRequestRepository.findByIdAndCompany(
        requestId,
        companyId,
      );
      if (!br) {
        this.logger.warn(`Bulk request not found on stalled: ${requestId}`);

        return;
      }
      const stalledMinutes = 10;
      const threshold = new Date(Date.now() - stalledMinutes * 60 * 1000);
      if (br.startedAt && br.startedAt < threshold) {
        this.logger.warn(`Bulk request ${requestId} stalled > ${stalledMinutes}min. Failing.`);
        await this.restoreFileStatusAfterProcessing(br, 'job stalled too long');
        br.fail(`Job stalled for more than ${stalledMinutes} minutes`);
        await this.bulkProcessingRequestRepository.update(br);
      } else {
        this.logger.debug(`Stalled job for ${requestId} still within limits`);
      }
    } catch (e) {
      this.logger.error(`Stalled cleanup failed for ${requestId}: ${e?.message || e}`);
    }
  }
}
