/* eslint-disable @typescript-eslint/no-explicit-any */
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ConfigService } from '@nestjs/config';
import { format } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';

import { ILogger } from '@core/interfaces/logger.interface';
import { IFileRepository } from '@core/repositories/file.repository.interface';
import { IBulkProcessingRequestRepository } from '@core/repositories/bulk-processing-request.repository.interface';
import { IStorageService } from '@core/repositories/storage.service.interface';
import { IProductCatalogRepository } from '@core/repositories/product-catalog.repository.interface';
import { IBulkProcessingContext } from '@core/services/bulk-processing.service';
import { IBulkProcessingFlatOptions } from '@core/interfaces/bulk-processing-options.interface';

import { File } from '@core/entities/file.entity';
import {
  BulkProcessingRequest,
  IBulkProcessingRowLog,
} from '@core/entities/bulk-processing-request.entity';
import { PaymentOption } from '@prisma/client';

import {
  IExcelParsingOptions,
  IExcelRowProcessor,
  IExcelStreamingResult,
  IExcelValidationResult,
} from '@core/services/excel-streaming.service';

import { FileDownloadStreamingService } from '@core/services/file-download-streaming.service';

import { UpsertProductCatalogCommand } from '@application/commands/product-catalog/upsert-product-catalog.command';
import { CreateProductMediaCommand } from '@application/commands/product-media/create-product-media.command';
import { UpdateProductVisibilityCommand } from '@application/commands/product-catalog/update-product-visibility.command';
import { DeleteProductCatalogWithMediaCommand } from '@application/commands/product-catalog/delete-product-catalog-with-media.command';
import { IProductWithMultimedia } from '@application/queries/product-catalog/get-products-by-bulk-request.query';
import { buildCommonPath, CommonFolder } from '@shared/index';
import { BulkProcessingEventType } from '@shared/constants/bulk-processing-type.enum';
import { BulkProcessingStatus } from '@shared/constants/bulk-processing-status.enum';
import { BulkProcessingEventBus } from '../bulk-processing-event-bus';
import {
  StorageAppKeys,
  StorageAppsMapTags,
  StorageInverseAppsMap,
  UserStorageConfig,
} from '@core/entities/user-storage-config.entity';
import { ProductMedia } from '@core/entities/product-media.entity';
import { FileStatus } from '@core/value-objects/file-status.vo';
import { CreateProductCatalogDto } from '@application/dtos/product-catalog/create-product-catalog.dto';
import { TargetAppsEnum } from '@shared/constants/target-apps.enum';

export interface IProductCatalogTemplateXLSX {
  id: string | null;
  industry: string;
  productService: string;
  type: string;
  subcategory: string | null;
  listPrice: number | null;
  paymentOptions: string;
  description: string;
  langCode: string;
  link: string | null;
  pdfLinks: string | null;
  photoLinks: string | null;
  videoLinks: string | null;
}

export class ProductCatalogRowProcessor implements IExcelRowProcessor<IProductCatalogTemplateXLSX> {
  private static readonly PHOTO_EXTENSIONS: string[] = [
    '.jpg',
    '.jpeg',
    '.jpe',
    '.jif',
    '.jfif',
    '.jfi',
    '.png',
    '.gif',
    '.webp',
    '.bmp',
    '.dib',
    '.tif',
    '.tiff',
    '.heic',
    '.heif',
    '.svg',
    '.raw',
    '.ico',
  ];
  private static readonly VIDEO_EXTENSIONS: string[] = [
    '.mp4',
    '.m4v',
    '.3gp',
    '.3g2',
    '.avi',
    '.mov',
    '.qt',
    '.wmv',
    '.flv',
    '.f4v',
    '.swf',
    '.mkv',
    '.webm',
    '.vob',
    '.mpg',
    '.mpeg',
    '.mpe',
    '.mpv',
    '.ts',
    '.m2ts',
    '.mts',
  ];
  private static readonly DOCS_EXTENSIONS: string[] = [
    '.pdf',
    // Microsoft Office
    '.doc',
    '.docx',
    '.dot',
    '.dotx',
    '.xls',
    '.xlsx',
    '.xlt',
    '.xltx',
    '.ppt',
    '.pptx',
    '.pps',
    '.ppsx',
    // OpenDocument
    '.odt',
    '.ods',
    '.odp',
    '.odg',
    '.odf',
    // Text
    '.txt',
    '.rtf',
    '.md',
    '.csv',
    '.tsv',
    '.log',
    // Otros comunes
    '.epub',
    '.key',
    '.pages',
    '.numbers',
  ];
  private static readonly ALL_EXTENSIONS: string[] = [
    ...this.PHOTO_EXTENSIONS,
    ...this.VIDEO_EXTENSIONS,
    ...this.DOCS_EXTENSIONS,
  ];
  private static readonly PHOTO_EXTENSIONS_MAP: Map<string, boolean> = new Map(
    this.PHOTO_EXTENSIONS.map(v => [v, true]),
  );
  private static readonly VIDEO_EXTENSIONS_MAP: Map<string, boolean> = new Map(
    this.VIDEO_EXTENSIONS.map(v => [v, true]),
  );
  private static readonly DOCS_EXTENSIONS_MAP: Map<string, boolean> = new Map(
    this.DOCS_EXTENSIONS.map(v => [v, true]),
  );
  private static readonly ALL_EXTENSIONS_MAP: Map<string, boolean> = new Map([
    ...this.PHOTO_EXTENSIONS_MAP,
    ...this.VIDEO_EXTENSIONS_MAP,
    ...this.DOCS_EXTENSIONS_MAP,
  ]);

  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly fileDownloadService: FileDownloadStreamingService,
    private readonly logger: ILogger,
    private readonly context: IBulkProcessingContext,
    private bulkRequest: BulkProcessingRequest,
    private readonly bulkProcessingRequestRepository: IBulkProcessingRequestRepository,
    private readonly configService: ConfigService,
    private readonly fileRepository: IFileRepository,
    private readonly productCatalogRepository: IProductCatalogRepository,
    private readonly allowedExtensions: string[],
    private readonly userStorageConfig: UserStorageConfig,
    private readonly storageService: IStorageService,
    private readonly bulkProcessingEventBus: BulkProcessingEventBus,
  ) {}

  public getParsingOptionsForEventType(
    eventType: string,
    context: IBulkProcessingContext,
  ): IExcelParsingOptions {
    const options: IBulkProcessingFlatOptions = context.options || {};

    // Apply parsing options from context
    const base: Omit<IExcelParsingOptions, 'columnMapping'> = {
      fileName: context.fileName,
      eventType,
      metadata: { ...context.metadata, ...options.metadata },
      startRow: options.startRow ?? 1,
      skipEmptyRows: options.skipEmptyRows ?? true,
      trimValues: options.trimValues ?? true,
      sheetName: options.sheetName,
      //csvDelimiter: options.csvDelimiter,
    };

    switch (eventType) {
      case BulkProcessingEventType.PRODUCT_CATALOG_BULK_IMPORT: {
        // Fixed column mapping by index (backend-defined)
        // This mapping assumes a specific column order in the Excel file:
        // A=id, B=industry, C=productService, D=type, E=subcategory, F=listPrice,
        // G=paymentOptions, H=description, I=langCode, J=link, K=pdfLinks, L=photoLinks, M=videoLinks
        const fixedColumnMapping = {
          id: 'A', // Column A (0)
          industry: 'B', // Column B (1)
          productService: 'C', // Column C (2)
          type: 'D', // Column D (3)
          subcategory: 'E', // Column E (4)
          listPrice: 'F', // Column F (5)
          paymentOptions: 'G', // Column G (6)
          description: 'H', // Column H (7)
          langCode: 'I', // Column I (8)
          link: 'J', // Column J (9)
          pdfLinks: 'K', // Column K (10)
          photoLinks: 'L', // Column L (11)
          videoLinks: 'M', // Column M (12)
        };

        return { ...base, columnMapping: fixedColumnMapping };
      }
      default:
        throw new Error(`No column mapping defined for event type: ${eventType}`);
    }
  }

  createNewRow(): IProductCatalogTemplateXLSX {
    return {
      id: null,
      industry: null,
      productService: null,
      type: null,
      subcategory: null,
      listPrice: null,
      paymentOptions: null,
      description: null,
      langCode: null,
      link: null,
      pdfLinks: null,
      photoLinks: null,
      videoLinks: null,
    };
  }

  async setLogs(bulkRequest: BulkProcessingRequest, result: IExcelStreamingResult): Promise<void> {
    // Loguea errores por fila (capando en el servicio ya)
    for (const e of result.errors) {
      const rowLog: IBulkProcessingRowLog = {
        rowNumber: e.rowNumber,
        entityId: e.metadata?.productId,
        entityType: 'Product',
        errors: e.errors,
        warnings: e.warnings,
        metadata: e.metadata,
        processedAt: new Date(),
      };
      bulkRequest.addRowLog(rowLog);
    }

    // Actualizar contadores directamente con los resultados del streaming
    bulkRequest.updateCounters(result.processedRows, result.successfulRows, result.failedRows);
    await this.bulkProcessingRequestRepository.update(bulkRequest);
  }

  async onStart(totalRows: number, _context?: IBulkProcessingContext): Promise<void> {
    this.logger.log(`Starting product catalog processing (${totalRows} rows unknown upfront).`);
    this.bulkRequest.start(totalRows || 0);
    await this.bulkProcessingRequestRepository.update(this.bulkRequest);
  }

  async processRow(
    rowData: IProductCatalogTemplateXLSX,
    rowNumber: number,
    context: IBulkProcessingContext,
  ): Promise<IExcelValidationResult> {
    const out: IExcelValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
      //transformedData: {},
      metadata: {},
    };

    const options: IBulkProcessingFlatOptions = context.options || {};

    // Check for cancellation before processing each row (outside try-catch to allow cancellation to propagate)
    await context?.cancellationChecker?.();

    try {
      // Check if dry run mode
      if (options.dryRun) {
        out.metadata = { dryRun: true, skipped: true };
      }

      // Skip validation if configured
      if (!options.skipValidation) {
        const errs = this.validateRow(rowData);
        if (errs.length) {
          // Check if we should treat warnings as errors
          if (options.treatWarningsAsErrors) {
            out.errors = [...out.errors, ...errs];
          } else {
            out.warnings = errs;
          }

          // Check if we should continue on validation errors
          if (!options.continueOnValidationError && errs.length > 0) {
            out.isValid = false;
            out.errors = errs;
            await this.logRow(rowNumber, out, undefined);

            // Stop on first error if configured
            if (options.stopOnFirstError) {
              throw new Error(`Stopping at row ${rowNumber} due to validation errors`);
            }

            return out;
          }
        }
      }

      // Build metadata with multimedia URLs from Excel columns
      const metadata: Record<string, string> = {};
      if (rowData.pdfLinks && String(rowData.pdfLinks).trim()) {
        metadata.pdf = String(rowData.pdfLinks).trim();
      }
      if (rowData.photoLinks && String(rowData.photoLinks).trim()) {
        metadata.photo = String(rowData.photoLinks).trim();
      }
      if (rowData.videoLinks && String(rowData.videoLinks).trim()) {
        metadata.video = String(rowData.videoLinks).trim();
      }

      // Upsert producto with metadata
      const productId = await this.upsertProduct(
        rowData,
        rowNumber,
        Object.keys(metadata).length > 0 ? metadata : undefined,
      );
      out.metadata = { productId, entityType: 'ProductCatalog' };

      // Skip media processing in first phase for faster Excel streaming
      // Media will be processed in second phase after Excel streaming completes
      if (!options.skipMediaDownload && !options.dryRun && options.processMediaInFirstPhase) {
        // Check for cancellation before media processing (outside try-catch to allow cancellation to propagate)
        await context?.cancellationChecker?.();

        try {
          await this.processMedia(this.userStorageConfig, productId, rowData, out, context);
        } catch (mediaError: any) {
          if (!options.continueOnMediaError) {
            throw mediaError;
          }
          out.warnings.push(`Media processing failed: ${mediaError.message}`);
        }
      } else if (!options.skipMediaDownload && !options.dryRun) {
        // Media URLs are now stored directly in product metadata
        // Only mark if has multimedia for tracking purposes
        out.metadata = {
          ...out.metadata,
          hasMultimedia: this.hasMultimediaUrls(rowData),
        };
      }

      // Log éxito (si necesitas)
      await this.logRow(rowNumber, out, productId);
    } catch (e: any) {
      out.isValid = false;
      out.errors.push(`Processing error: ${e?.message ?? String(e)}`);
      await this.logRow(rowNumber, out, undefined);
    }

    if (this.context.job) {
      const options: IBulkProcessingFlatOptions = this.context.options || {};
      const total =
        this.bulkRequest.totalRows || Math.max(this.bulkRequest.totalRows || rowNumber, rowNumber);

      // Calculate progress based on processing phase
      if (options.processMediaInFirstPhase) {
        // Single phase processing: 0-100%
        const progress = Math.min(99, Math.floor((rowNumber / Math.max(1, total)) * 90) + 10);
        await this.context.job.updateProgress(progress);
      } else {
        // Two-phase processing: Excel streaming is 0-50%
        const excelProgress = Math.floor((rowNumber / Math.max(1, total)) * 50);
        const progress = Math.min(50, excelProgress + 5); // 5% initial buffer
        await this.context.job.updateProgress(progress);
      }
    }

    return out;
  }

  async onComplete(
    processedCount: number,
    errorCount: number,
    _context?: IBulkProcessingContext,
  ): Promise<void> {
    // Detailed totals reporting - now just logging, completion logic is handled by onProcessingComplete
    const successfulCount = this.bulkRequest.successfulRows;
    const failedCount = this.bulkRequest.failedRows;
    const totalRows = this.bulkRequest.totalRows;

    this.logger.log(
      `📊 EXCEL PROCESSING COMPLETE - Request ${this.bulkRequest.id.getValue()}:\n` +
        `  • Total rows: ${totalRows}\n` +
        `  • Processed: ${processedCount}\n` +
        `  • Successful: ${successfulCount}\n` +
        `  • Failed: ${failedCount}\n` +
        `  • Errors: ${errorCount}\n` +
        `  • Success rate: ${totalRows > 0 ? Math.round((successfulCount / totalRows) * 100) : 0}%`,
    );

    // Note: Actual completion logic is now handled by onProcessingComplete() method
    // which is called by the verticalized service to respect proper architecture separation
  }

  async onBatchUpdate(
    processedCount: number,
    successfulCount: number,
    failedCount: number,
    context?: IBulkProcessingContext,
  ): Promise<void> {
    if (!context) return;

    // Actualizar contadores del bulkRequest
    this.bulkRequest.updateCounters(processedCount, successfulCount, failedCount);

    // Persistir en base de datos
    await this.bulkProcessingRequestRepository.update(this.bulkRequest);

    this.logger.debug(
      `Batch update: ${processedCount} processed (${successfulCount} ok, ${failedCount} fail)`,
    );
  }

  async onError(error: Error, _context?: IBulkProcessingContext): Promise<void> {
    this.logger.error(`Product catalog error: ${error.message}`, error.stack);
  }

  // ----- helpers -----

  /**
   * Centralized logic to determine if second phase media processing is needed
   * This ensures consistent decision making across the entire processor
   */
  private needsSecondPhaseMediaProcessing(options: IBulkProcessingFlatOptions): boolean {
    // If media download is skipped, no second phase needed
    if (options.skipMediaDownload) {
      return false;
    }

    // If this is a dry run, no second phase needed
    if (options.dryRun) {
      return false;
    }

    // If media was already processed in first phase, no second phase needed
    if (options.processMediaInFirstPhase) {
      return false;
    }

    // If we get here, we need second phase media processing
    return true;
  }

  /**
   * ProductCatalogProcessor handles its own completion logic because it may need second phase
   */
  handlesCompletion(): boolean {
    return true;
  }

  /**
   * ProductCatalogProcessor handles all state management internally
   */
  getStateManagementConfig() {
    return {
      handlesCompletion: true,
      handlesFileStatusRestoration: true,
      handlesProgressUpdates: true,
      handlesErrorStates: true,
    };
  }

  /**
   * Called by the service when processing completes successfully
   * This is the new interface method that replaces the onComplete method logic
   */
  async onProcessingComplete(result: IExcelStreamingResult): Promise<void> {
    const options: IBulkProcessingFlatOptions = this.context?.options || {};

    // Mark Excel processing as completed
    this.bulkRequest.markExcelProcessingCompleted();
    await this.bulkProcessingRequestRepository.update(this.bulkRequest);

    // Determine if we need second phase media processing
    if (this.needsSecondPhaseMediaProcessing(options)) {
      this.logger.log(
        `Scheduling second phase media processing for request ${this.bulkRequest.id.getValue()}`,
      );

      // Update job progress to 50% as Excel is complete but media processing is pending
      if (this.context?.job) {
        await this.context.job.updateProgress(50);
      }

      // Schedule second phase media processing
      await this.scheduleSecondPhaseMediaProcessing(result.totalRows);
    } else {
      // Complete the entire bulk request - single phase processing
      this.bulkRequest.complete(
        result.totalRows > 0 ? result.totalRows : this.bulkRequest.totalRows || undefined,
      );
      await this.bulkProcessingRequestRepository.update(this.bulkRequest);

      // Mark file as erasing (ready for cleanup)
      await this.markFileAsErasing();

      // Update progress to 100%
      if (this.context?.job) {
        await this.context.job.updateProgress(100);
      }

      this.logger.log(
        `Single-phase bulk processing fully completed for ${this.bulkRequest.id.getValue()}`,
      );
    }
  }

  /**
   * Called by the service when processing fails
   * This handles error states internally
   */
  async onProcessingFailed(error: Error, _context: IBulkProcessingContext): Promise<void> {
    this.logger.error(
      `ProductCatalogProcessor handling failure for ${this.bulkRequest.id.getValue()}: ${error.message}`,
    );

    // Get the latest state from database to avoid race conditions
    const latestBulkRequest = await this.bulkProcessingRequestRepository.findByIdAndCompany(
      this.bulkRequest.id.getValue(),
      this.context.companyId,
    );

    if (!latestBulkRequest) {
      this.logger.warn(`Bulk request not found: ${this.bulkRequest.id.getValue()}`);

      return;
    }

    // Check if request is being cancelled vs actually failed (using latest state)
    if (latestBulkRequest.isCancelling()) {
      this.logger.log(
        `Request ${this.bulkRequest.id.getValue()} is being cancelled, not marking as failed`,
      );

      return;
    }

    // Mark as failed only if it's not being cancelled (using latest state)
    if (!latestBulkRequest.hasFailed() && !latestBulkRequest.isCompleted()) {
      latestBulkRequest.fail(error.message);
      await this.bulkProcessingRequestRepository.update(latestBulkRequest);

      // Update local instance to keep it in sync
      this.bulkRequest = latestBulkRequest;

      // Restore file status after failure
      await this.restoreFileStatusAfterCompletion();

      this.logger.log(`Bulk processing marked as failed for ${this.bulkRequest.id.getValue()}`);
    }
  }

  /**
   * Called when processing is cancelled
   * Handles comprehensive cancellation cleanup
   */
  async onProcessingCancelled(context: IBulkProcessingContext): Promise<void> {
    const requestId = this.bulkRequest.id.getValue();
    this.logger.log(
      `Starting comprehensive cancellation cleanup for ProductCatalog request: ${requestId}`,
    );

    try {
      // Delete all products created by this bulk request
      await this.cleanupCreatedProducts(context);

      this.logger.log(`Comprehensive cancellation cleanup completed for request: ${requestId}`);
    } catch (error) {
      this.logger.error(`Cancellation cleanup failed for request ${requestId}: ${error}`);
      // Don't throw - let the main cancellation process continue
    }
  }

  /**
   * Determines if file status should be restored for different events
   * ProductCatalogProcessor handles file restoration internally
   */
  shouldRestoreFileStatus(_event: 'completion' | 'failure' | 'cancellation'): boolean {
    // ProductCatalogProcessor handles file restoration internally via restoreFileStatusAfterCompletion
    return false;
  }

  /**
   * Gets custom progress update for different phases
   * Adjusts progress based on whether media processing is in first phase or second phase
   */
  getProgressUpdate(phase: 'start' | 'processing' | 'completion', currentProgress: number): number {
    const options: IBulkProcessingFlatOptions = this.context?.options || {};

    switch (phase) {
      case 'start':
        return 5; // Initial progress
      case 'processing':
        // If processing media in first phase, keep progress lower to account for media time
        if (options.processMediaInFirstPhase) {
          return Math.min(95, currentProgress); // Leave room for final completion
        } else {
          return Math.min(50, currentProgress); // Excel only goes to 50%, media is second phase
        }
      case 'completion':
        // If media is processed in first phase, this is true completion (100%)
        if (options.processMediaInFirstPhase || options.skipMediaDownload || options.dryRun) {
          return 100;
        } else {
          // Excel completion but media pending, so 50%
          return 50;
        }
      default:
        return currentProgress;
    }
  }

  /**
   * Restores file status after completion
   */
  private async restoreFileStatusAfterCompletion(): Promise<void> {
    try {
      const file = await this.fileRepository.findById(this.context.fileId);
      if (!file) {
        this.logger.warn(`File not found for restoration: ${this.context.fileId}`);

        return;
      }

      // Get original status from bulk request metadata
      const originalStatus = this.bulkRequest.metadata?.originalFileStatus as string;

      if (originalStatus) {
        file.restoreStatus(originalStatus);
        await this.fileRepository.update(file);
        this.logger.log(`File ${this.context.fileId} status restored to ${originalStatus}`);
      } else {
        if (file.status === FileStatus.pending()) {
          // Fallback to UPLOADED if no original status found
          file.restoreToUploaded();
          await this.fileRepository.update(file);
          this.logger.log(
            `File ${this.context.fileId} status restored to ${FileStatus.uploaded()} (fallback)`,
          );
        }
      }
    } catch (error) {
      this.logger.error(`Failed to restore file status: ${error}`);
      // Don't throw - completion should still succeed even if file status restoration fails
    }
  }

  /**
   * Mark the bulk processing file as erasing and schedule cleanup job
   */
  private async markFileAsErasing(): Promise<void> {
    try {
      const filesToCleanup: string[] = [];

      if (this.context.fileId) {
        // Get the file from database
        const file = await this.fileRepository.findById(this.context.fileId);

        if (file) {
          // Mark as erasing
          file.markAsErasing();

          // Update in database
          await this.fileRepository.update(file);

          // Add to cleanup list
          filesToCleanup.push(this.context.fileId);

          this.logger.log(
            `Marked file ${this.context.fileId} as ERASING for request ${this.context.requestId}`,
          );
        } else {
          this.logger.warn(
            `File ${this.context.fileId} not found for marking as erasing in request ${this.context.requestId}`,
          );
        }
      }

      // Schedule cleanup job with the event bus if there are files to clean
      if (filesToCleanup.length > 0) {
        this.logger.log(
          `Attempting to schedule cleanup job for request ${this.context.requestId} with ${filesToCleanup.length} files`,
        );

        const result = await this.bulkProcessingEventBus.queueCleanupJob(
          {
            requestId: this.context.requestId,
            fileId: this.context.fileId || this.context.requestId,
            companyId: this.context.companyId,
            userId: this.context.userId,
            filesToCleanup,
            metadata: {
              eventType: this.context.eventType,
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
          `✅ Scheduled cleanup job ${result.jobId} for request ${this.context.requestId} with ${filesToCleanup.length} files - will execute immediately`,
        );
      }
    } catch (error) {
      this.logger.error(
        `Failed to mark file as erasing and schedule cleanup for request ${this.context.requestId}: ${error?.message || error}`,
      );
    }
  }

  /**
   * Clean up all products created by this bulk request using pagination to avoid memory overload
   */
  private async cleanupCreatedProducts(context: IBulkProcessingContext): Promise<void> {
    try {
      this.logger.log(`Starting product cleanup for bulk request: ${context.requestId}`);

      const CHUNK_SIZE = 50;
      let offset = 0;
      let hasMore = true;
      let totalDeleted = 0;

      while (hasMore) {
        // Get products in chunks to avoid loading all products in memory
        const productChunk = await this.productCatalogRepository.findByBulkRequestId(
          context.requestId,
          context.companyId,
          CHUNK_SIZE,
          offset,
        );

        if (productChunk.length === 0) {
          hasMore = false;
          break;
        }

        // Delete each product in the current chunk
        for (const product of productChunk) {
          try {
            await this.commandBus.execute(
              new DeleteProductCatalogWithMediaCommand(
                product.id.getValue(),
                context.companyId,
                context.userId,
              ),
            );
            totalDeleted++;
            this.logger.debug(
              `Deleted product ${product.id.getValue()} for bulk request: ${context.requestId}`,
            );
          } catch (error) {
            this.logger.error(
              `Failed to delete product ${product.id.getValue()} for bulk request ${context.requestId}: ${error}`,
            );
            // Continue with other products even if one fails
          }
        }

        offset += CHUNK_SIZE;

        // If we got less than chunk size, we've reached the end
        if (productChunk.length < CHUNK_SIZE) {
          hasMore = false;
        }

        this.logger.debug(
          `Processed chunk: ${Math.min(offset, totalDeleted + (productChunk.length - totalDeleted))} products for bulk request: ${context.requestId}`,
        );
      }

      this.logger.log(
        `Product cleanup completed. Deleted ${totalDeleted} products for bulk request: ${context.requestId}`,
      );
    } catch (error) {
      this.logger.error(`Product cleanup failed for bulk request ${context.requestId}: ${error}`);
    }
  }

  private validateRow(row: IProductCatalogTemplateXLSX): string[] {
    const options: IBulkProcessingFlatOptions = this.context?.options || {};

    // Skip validation if configured
    if (options.skipValidation) {
      return [];
    }

    const errs: string[] = [];
    if (!row.industry) errs.push('Industry is required');
    if (!row.productService) errs.push('Product/Service is required');
    if (!row.type) errs.push('Type is required');
    if (!row.description || row.description.trim().length === 0)
      errs.push('Description is required');
    if (!row.paymentOptions) errs.push('Payment options are required');

    if (row.paymentOptions) {
      const tokens = String(row.paymentOptions)
        .split(/[,;]/)
        .map(s => s.trim())
        .filter(Boolean);
      const valid = new Set(Object.values(PaymentOption));
      const invalid = tokens.filter(t => !valid.has(t as PaymentOption));
      if (invalid.length) errs.push(`Invalid payment options: ${invalid.join(', ')}`);
    }

    // Check if media extension validation is enabled
    if (options.validateMediaExtensions !== false) {
      // Validate media URLs have valid extensions
      const validateUrls = (urls: string, type: string, validExts: string[]) => {
        const parsed = FileDownloadStreamingService.parseUrlsFromString(String(urls || ''));
        for (const url of parsed) {
          const ext = url.toLowerCase().match(/\.[^.]+$/)?.[0];
          if (ext && !validExts.includes(ext)) {
            errs.push(`Invalid ${type} extension: ${ext}`);
          }
        }
      };

      if (row.pdfLinks)
        validateUrls(row.pdfLinks as string, 'PDF', ProductCatalogRowProcessor.DOCS_EXTENSIONS);
      if (row.photoLinks)
        validateUrls(
          row.photoLinks as string,
          'photo',
          ProductCatalogRowProcessor.PHOTO_EXTENSIONS,
        );
      if (row.videoLinks)
        validateUrls(
          row.videoLinks as string,
          'video',
          ProductCatalogRowProcessor.VIDEO_EXTENSIONS,
        );
    }

    return errs;
  }

  private async processMedia(
    userStorageConfig: UserStorageConfig,
    productId: string,
    row: IProductCatalogTemplateXLSX,
    out: IExcelValidationResult,
    context: IBulkProcessingContext,
  ): Promise<void> {
    const parse = FileDownloadStreamingService.parseUrlsFromString;
    const pdfLinks = parse(String(row.pdfLinks || ''));
    const photoLinks = parse(String(row.photoLinks || ''));
    const videoLinks = parse(String(row.videoLinks || ''));

    const all = [...pdfLinks, ...photoLinks, ...videoLinks];
    if (!all.length) return;

    const clamp = (value: number, min: number, max: number): number => {
      return Math.max(min, Math.min(max, value));
    };

    const rawTimeout =
      context?.options?.mediaDownloadTimeout ??
      context?.options?.downloadTimeout ??
      this.configService.get<number>('queue.bulkProcessing.downloadTimeoutMs', 30000);

    const downloadTimeoutMs = clamp(rawTimeout, 30_000, 60_000); // entre 30s y 60s

    const maxFileSizeMB = this.configService.get<number>('queue.bulkProcessing.maxFileSizeMB', 10);

    const downloadRetries = clamp(
      this.configService.get<number>('queue.bulkProcessing.downloadRetries', 2),
      0,
      10, // ejemplo: máximo 10 reintentos
    );

    const maxSimultaneousFiles = clamp(
      context?.options?.maxMediaConcurrency ?? context?.options?.maxConcurrency ?? 1,
      1,
      3,
    ); // entre 1 y 3 | concurrencia=1 para 512 MB

    const bucket = this.configService.get<string>('storage.defaultBucket', 'files');

    let basePath = buildCommonPath(this.context.companyId, CommonFolder.PRODUCTS, `downloads`);

    // Check for cancellation before expensive media operations (outside try-catch to allow cancellation to propagate)
    await context?.cancellationChecker?.();

    try {
      if (basePath) {
        if (!(await this.storageService.folderExists(bucket, basePath))) {
          await this.storageService.createFolder(bucket, basePath);
        }
      }

      basePath += `/${productId}`;

      // Check for cancellation before batch download (potentially long operation)
      await context?.cancellationChecker?.();

      const r = await this.fileDownloadService.downloadFilesBatch(
        context,
        all,
        {
          baseStoragePath: basePath,
          allowedExtensions: this.allowedExtensions,
          maxFileSize: maxFileSizeMB * 1024 * 1024,
          timeout: downloadTimeoutMs,
          retryAttempts: downloadRetries,
          generateUniqueNames: true,
          preserveExtension: true,
          metadata: {
            productId,
            requestId: this.context.requestId,
            uploadedBy: this.context.userId,
          },
        },
        maxSimultaneousFiles,
      );

      await context?.cancellationChecker?.();

      for (const f of r.results) {
        // Check for cancellation during media file processing (can be many files)
        await context?.cancellationChecker?.();

        if (!f.success || !f.storagePath) {
          out.warnings.push(`Failed to download ${f.originalUrl}: ${f.error}`);
          continue;
        }

        try {
          const bucket = this.configService.get<string>('storage.defaultBucket', 'files');
          const storageDriver = this.configService.get<string>('storage.provider', 'minio');

          // Calculate targetApps based on user's tier and file compatibility
          const targetApps = this.calculateTargetAppsForFile(
            userStorageConfig,
            f.fileSize || 0,
            f.downloadedFileName,
          );

          const file = File.createForUpload(
            f.downloadedFileName,
            f.downloadedFileName,
            f.storagePath,
            f.storagePath,
            f.mimeType || 'application/octet-stream',
            f.fileSize || 0,
            bucket,
            this.context.userId,
            true,
            targetApps,
            storageDriver,
          );

          // Mark as uploaded and set etag if available
          file.markAsUploaded();
          if (f.etag) {
            file.setEtag(f.etag);
          }

          const saved = await this.fileRepository.save(file);

          const mediaType = ProductMedia.mapMimeTypeToFileType(f.mimeType);
          const tags = await this.inferTagsFromUrl(
            userStorageConfig,
            f.originalUrl,
            this.allowedExtensions,
            f.fileSize || 0,
          );

          await this.commandBus.execute(
            new CreateProductMediaCommand(
              {
                fileId: saved.id,
                fav: false,
                productId,
                description: `Media: ${mediaType} - downloaded from: ${f.originalUrl}`,
                tags,
              },
              this.context.companyId,
              this.context.userId,
            ),
          );
        } catch (e: any) {
          out.warnings.push(
            `Failed to create media record for ${f.originalUrl}: ${e?.message ?? String(e)}`,
          );
        }
      }

      await context?.cancellationChecker?.();

      out.metadata = {
        ...out.metadata,
        downloadedFiles: r.successfulDownloads,
        totalFiles: r.totalFiles,
        failedFiles: r.failedDownloads,
      };

      // Update product visibility after successful media processing
      // If at least one file was successfully downloaded, make the product visible
      if (r.successfulDownloads > 0) {
        try {
          await this.commandBus.execute(
            new UpdateProductVisibilityCommand(
              productId,
              true, // Make product visible
              this.context.companyId,
              this.context.userId,
              true, // Force overwrite visibility
            ),
          );
        } catch (error) {
          this.logger.warn(`Failed to update product visibility for ${productId}: ${error}`);
          out.warnings.push(`Failed to update product visibility: ${error}`);
        }
      }
    } catch (e: any) {
      // Re-throw cancellation errors to allow proper cancellation handling
      if (e?.name === 'JobCancelledException' || e?.message?.includes('Job cancelled')) {
        throw e;
      }
      out.warnings.push(`Multimedia processing failed: ${e?.message ?? String(e)}`);
    }
  }

  private setCompatibleApps(
    userStorageConfig: UserStorageConfig,
    fileSizeBytes: number,
    appCompatible: Record<string, boolean>,
    appsList: StorageAppKeys[],
    ...extensions: string[]
  ): void {
    for (const ext of extensions) {
      for (const app of appsList) {
        if (userStorageConfig.getMaxBytesForExtensionInApp(ext, app) >= fileSizeBytes) {
          appCompatible[app] = true;
        }
      }
    }
  }

  private calculateTargetAppsForFile(
    userStorageConfig: UserStorageConfig,
    fileSizeBytes: number,
    fileName: string,
  ): TargetAppsEnum[] {
    // Always add NONE by default!
    const targetApps: TargetAppsEnum[] = [TargetAppsEnum.NONE];

    // Get file extension from filename
    const lastDotIndex = fileName.lastIndexOf('.');
    if (lastDotIndex === -1) return targetApps;

    const ext = fileName.substring(lastDotIndex + 1).toLowerCase();

    // Check if this extension is allowed for the user
    const allowedExtensions = userStorageConfig.getAllowedExtensions();
    if (!allowedExtensions.includes(ext)) {
      return targetApps;
    }

    // Get available apps from user's tier configuration
    const availableApps = userStorageConfig.getAvailableApps();

    let found: boolean = false;

    // Check each app to see if it supports this file size for this extension
    for (const app of availableApps) {
      const maxBytes = userStorageConfig.getMaxBytesForExtensionInApp(
        ext,
        StorageInverseAppsMap[app],
      );
      if (maxBytes >= fileSizeBytes) {
        if (!found) {
          targetApps.pop(); // Remove NONE
          found = true;
        }
        targetApps.push(app);
      }
    }

    return targetApps;
  }

  private async inferTagsFromUrl(
    userStorageConfig: UserStorageConfig,
    url: string,
    allowed: string[],
    fileSizeBytes: number,
  ): Promise<string> {
    const tags: string[] = [];
    if (userStorageConfig) {
      const u = url.toLowerCase();
      const appCompatible: Record<string, boolean> = {};
      const appsList: StorageAppKeys[] = Object.keys(StorageAppsMapTags).map(
        key => key as StorageAppKeys,
      );
      let knownExtension = false;

      // Extract file extension from URL
      const urlExtension = u.match(/\.([a-z0-9]+)(\?|$)/)?.[1];
      const normalizedExtension = urlExtension ? `.${urlExtension}` : null;

      // Check if this specific file has a known extension
      if (
        normalizedExtension &&
        ProductCatalogRowProcessor.ALL_EXTENSIONS_MAP.has(normalizedExtension)
      ) {
        if (!allowed || allowed.includes(normalizedExtension)) {
          knownExtension = true;

          // Add specific tags for the detected extension
          if (normalizedExtension === '.pdf') {
            if (this.context.eventType === BulkProcessingEventType.PRODUCT_CATALOG_BULK_IMPORT) {
              tags.push('#ficha-tecnica');
            }
          }

          if (ProductCatalogRowProcessor.DOCS_EXTENSIONS_MAP.has(normalizedExtension)) {
            tags.push('#document', `#${normalizedExtension.replace('.', '')}`);
          }

          if (ProductCatalogRowProcessor.PHOTO_EXTENSIONS_MAP.has(normalizedExtension)) {
            if (normalizedExtension === '.jpg') {
              tags.push('#photo', `#jpeg`);
            } else {
              tags.push('#photo', `#${normalizedExtension.replace('.', '')}`);
            }
          }

          if (ProductCatalogRowProcessor.VIDEO_EXTENSIONS_MAP.has(normalizedExtension)) {
            tags.push('#video', `#${normalizedExtension.replace('.', '')}`);
          }

          // Set compatible apps for this specific extension
          this.setCompatibleApps(
            userStorageConfig,
            fileSizeBytes,
            appCompatible,
            appsList,
            normalizedExtension,
          );
        }
      }

      if (u.includes('catalog') || u.includes('catalogue')) tags.push('#catalog');
      if (u.includes('spec') || u.includes('specification')) tags.push('#specification');
      if (u.includes('demo') || u.includes('tutorial')) tags.push('#demo');
      if (u.includes('promo') || u.includes('promotional')) tags.push('#promotional');

      for (const appKey of Object.keys(appCompatible)) {
        const appTag = StorageAppsMapTags[appKey];
        if (appTag) {
          tags.push(appTag);
        }
      }

      // Only add unknown-media if we couldn't detect any valid extension
      if (!knownExtension) {
        tags.push('#unknown-media');
      }
    }

    return tags.length ? tags.join(' ') : '#media';
  }

  private hasMultimediaUrls(row: IProductCatalogTemplateXLSX): boolean {
    const parse = FileDownloadStreamingService.parseUrlsFromString;
    const pdfLinks = parse(String(row.pdfLinks || ''));
    const photoLinks = parse(String(row.photoLinks || ''));
    const videoLinks = parse(String(row.videoLinks || ''));

    return pdfLinks.length > 0 || photoLinks.length > 0 || videoLinks.length > 0;
  }

  private async scheduleSecondPhaseMediaProcessing(resultTotalRows: number): Promise<void> {
    try {
      // Ensure entity has correct totalRows from Excel processing phase
      if (
        (this.bulkRequest.totalRows === 0 || this.bulkRequest.totalRows === null) &&
        resultTotalRows > 0
      ) {
        // Get the latest entity from database to ensure we have correct state
        const latestBulkRequest = await this.bulkProcessingRequestRepository.findByIdAndCompany(
          this.bulkRequest.id.getValue(),
          this.context.companyId,
        );
        if (latestBulkRequest) {
          this.bulkRequest = latestBulkRequest;

          // If database also has null/0, force set it to resultTotalRows
          if (this.bulkRequest.totalRows === null || this.bulkRequest.totalRows === 0) {
            // We need to manually update totalRows since it wasn't set properly during Excel processing
            this.bulkRequest.setTotalRows(resultTotalRows);
            await this.bulkProcessingRequestRepository.update(this.bulkRequest);
          }
        }
      }

      this.logger.log(
        `Starting second phase media processing in streaming mode for bulk request ${this.bulkRequest.id.getValue()}`,
      );

      // Process products with multimedia in chunks without loading all in memory
      await this.processProductsWithMultimediaInChunks(resultTotalRows);

      // Report final totals before completion
      const successfulCount = this.bulkRequest.successfulRows;
      const failedCount = this.bulkRequest.failedRows;
      const totalRows = this.bulkRequest.totalRows;

      this.logger.log(
        `📊 MEDIA PROCESSING COMPLETE - Request ${this.bulkRequest.id.getValue()}:\n` +
          `  • Total rows: ${totalRows}\n` +
          `  • Successful: ${successfulCount}\n` +
          `  • Failed: ${failedCount}\n` +
          `  • Final success rate: ${totalRows > 0 ? Math.round((successfulCount / totalRows) * 100) : 0}%`,
      );

      await this.context?.cancellationChecker?.();

      // Mark bulk request as complete only if everything succeeded
      this.bulkRequest.complete(resultTotalRows);
      await this.bulkProcessingRequestRepository.update(this.bulkRequest);

      // Mark file as erasing (ready for cleanup)
      await this.markFileAsErasing();

      // Update progress to 100%
      if (this.context?.job) {
        await this.context.job.updateProgress(100);
      }

      this.logger.log(
        `✅ Successfully completed second phase media processing for bulk request ${this.bulkRequest.id.getValue()}`,
      );
    } catch (error) {
      // Check if this is a cancellation error - if so, don't mark as failed
      // The cancellation system will handle setting the correct status
      if (error?.name === 'JobCancelledException' || error?.message?.includes('Job cancelled')) {
        this.logger.log(
          `Second phase media processing was cancelled for bulk request ${this.bulkRequest.id.getValue()}`,
        );
        throw error; // Re-throw to let cancellation system handle it
      }

      // For non-cancellation errors, mark as failed
      this.logger.error(`Failed to complete second phase media processing: ${error}`);

      // Only try to fail if not already completed
      if (this.bulkRequest.status !== BulkProcessingStatus.COMPLETED) {
        this.bulkRequest.fail(`Second phase media processing failed: ${error}`);
        await this.bulkProcessingRequestRepository.update(this.bulkRequest);
      }

      throw error;
    }
  }

  private async processProductsWithMultimediaInChunks(totalRows: number): Promise<void> {
    try {
      const chunkSize = 50;
      let offset = 0;
      let hasMore = true;
      let totalProcessed = 0;

      this.logger.log(`Starting to process products with multimedia in chunks of ${chunkSize}`);

      while (hasMore) {
        // Check for cancellation before each chunk
        await this.context?.cancellationChecker?.();

        // Get chunk of products from database ordered by sourceRowNumber
        const chunk = await this.productCatalogRepository.findByBulkRequestId(
          this.bulkRequest.id.getValue(),
          this.context.companyId,
          chunkSize,
          offset,
        );

        if (!chunk || chunk.length === 0) {
          hasMore = false;
          break;
        }

        // Filter products with multimedia (those marked as invisible initially)
        //const productsWithMultimedia = chunk.filter(product => !product.isVisible);

        this.logger.debug(
          `Processing chunk at offset ${offset}: ${chunk.length} products (${chunk.length} with multimedia)`,
        );

        // Process each product with multimedia in this chunk
        for (const product of chunk) {
          try {
            // Check for cancellation before processing each product
            await this.context?.cancellationChecker?.();

            // Use metadata directly from the product entity
            const productId = product.id.getValue();

            // Convert to interface format using metadata
            const productWithMultimedia: IProductWithMultimedia = {
              id: productId,
              sourceRowNumber: product.sourceRowNumber || 0,
              isVisible: product.isVisible,
              metadata: product.metadata,
            };

            // Process multimedia for this product
            await this.processProductMediaInSecondPhase(productWithMultimedia);
            totalProcessed++;

            await this.context?.cancellationChecker?.();

            // Update progress occasionally based on total system progress
            if (this.context.job && totalProcessed % 5 === 0) {
              // Progress from 50% (Excel complete) to 99% (media processing, leaving 1% for final completion)
              const baseProgress = 50; // Excel processing is complete
              const mediaProgressRange = 49; // 50% to 99% = 49% range for media processing

              // Calculate progress based on total chunks processed in system
              let additionalProgress: number;
              const totalProcessedInSystem = offset + chunk.length; // Default value
              if (totalRows > 0) {
                // Total procesado en sistema hasta ahora (chunks completos leídos)
                const mediaProgressPercent = Math.min(1, totalProcessedInSystem / totalRows);
                additionalProgress = Math.floor(mediaProgressPercent * mediaProgressRange);
              } else {
                // Fallback: gradual increment (for cases where totalRows is unknown)
                additionalProgress = Math.min(
                  mediaProgressRange - 1,
                  Math.floor(totalProcessed / 4),
                );
              }

              const currentProgress = baseProgress + additionalProgress;
              await this.context.job.updateProgress(currentProgress);

              this.logger.debug(
                `Media processing progress: ${totalProcessed} multimedia processed, chunks progress ${totalProcessedInSystem}/${totalRows}, ${currentProgress}% complete`,
              );
            }
          } catch (error) {
            if (
              error?.name === 'JobCancelledException' ||
              error?.message?.includes('Job cancelled')
            ) {
              this.logger.log(
                `Second phase media processing cancelled at product ${product.id.getValue()}`,
              );
              throw error; // Re-throw cancellation errors
            }
            this.logger.warn(
              `Failed to process media for product ${product.id.getValue()}: ${error}`,
            );
          }
        }

        offset += chunkSize;

        // If we got less than chunk size, we've reached the end
        if (chunk.length < chunkSize) {
          hasMore = false;
        }
      }

      this.logger.log(
        `Completed processing ${totalProcessed} products with multimedia in streaming mode`,
      );

      // Set progress to 99% before final completion (leaving 1% for final completion step)
      if (this.context.job) {
        await this.context.job.updateProgress(99);
        this.logger.debug(
          'Media processing completed, progress set to 99% before final completion',
        );
      }

      // Don't mark as complete here - let the parent method handle it
    } catch (error) {
      this.logger.error(`Failed to process products with multimedia: ${error}`);
      throw error;
    }
  }

  private async processProductMediaInSecondPhase(product: IProductWithMultimedia): Promise<void> {
    if (!product.metadata) {
      this.logger.debug(`Product ${product.id} has no metadata for multimedia processing`);

      return;
    }

    // Extract URLs from metadata
    const allUrls: string[] = [];
    if (product.metadata.pdf) {
      allUrls.push(...product.metadata.pdf.split(',').map(url => url.trim()));
    }
    if (product.metadata.photo) {
      allUrls.push(...product.metadata.photo.split(',').map(url => url.trim()));
    }
    if (product.metadata.video) {
      allUrls.push(...product.metadata.video.split(',').map(url => url.trim()));
    }

    if (allUrls.length === 0) {
      this.logger.debug(`Product ${product.id} has no multimedia URLs in metadata`);

      return;
    }

    try {
      // Create fake rowData structure for processMedia method
      const fakeRowData: IProductCatalogTemplateXLSX = {
        id: product.id,
        industry: '',
        productService: '',
        type: '',
        subcategory: '',
        listPrice: null,
        paymentOptions: '',
        description: '',
        langCode: '',
        link: null,
        pdfLinks: product.metadata.pdf || null,
        photoLinks: product.metadata.photo || null,
        videoLinks: product.metadata.video || null,
      };

      const fakeOut: IExcelValidationResult = {
        isValid: true,
        errors: [],
        warnings: [],
        metadata: {},
      };

      // Process media using existing method
      await this.processMedia(
        this.userStorageConfig,
        product.id,
        fakeRowData,
        fakeOut,
        this.context,
      );

      await this.context?.cancellationChecker?.();

      // Log multimedia processing warnings/errors if any
      if (!fakeOut.isValid || fakeOut.warnings.length > 0 || fakeOut.errors.length > 0) {
        // Use addMultimediaWarning to avoid double-counting successful rows
        const rowLog: IBulkProcessingRowLog = {
          rowNumber: product.sourceRowNumber || 0,
          entityId: product.id,
          entityType: 'ProductCatalog',
          errors: fakeOut.errors,
          warnings: fakeOut.warnings,
          metadata: fakeOut.metadata,
          processedAt: new Date(),
        };
        this.bulkRequest.addMultimediaWarning(rowLog);
        await this.bulkProcessingRequestRepository.update(this.bulkRequest);
      }

      // Update product visibility after successful media processing
      await this.commandBus.execute(
        new UpdateProductVisibilityCommand(
          product.id,
          true,
          this.context.companyId,
          this.context.userId,
          true,
        ),
      );

      this.logger.debug(
        `Successfully processed multimedia for product ${product.id} and set visible=true`,
      );
    } catch (error) {
      this.logger.error(`Failed to process multimedia for product ${product.id}: ${error}`);
      throw error;
    }
  }

  private async upsertProduct(
    row: IProductCatalogTemplateXLSX,
    rowNumber: number,
    metadata?: Record<string, string>,
  ): Promise<string> {
    const ts = format(new Date(), 'dd-MM-yyyy-HH:mm:ss');
    const sourceFileName = this.context.fileName.replace(/(\.[^.]+)$/, `-${ts}$1`);

    const createDto: CreateProductCatalogDto = {
      id: row.id || uuidv4(),
      industry: String(row.industry).trim(),
      productService: String(row.productService).trim(),
      type: String(row.type).trim(),
      subcategory: row.subcategory ? String(row.subcategory).trim() : undefined,
      listPrice: row.listPrice ? Number(row.listPrice) : null,
      paymentOptions: String(row.paymentOptions)
        .split(/[,;]/)
        .map(s => s.trim())
        .filter(Boolean) as PaymentOption[],
      description: row.description ? String(row.description).trim() : undefined,
      langCode: row.langCode ? String(row.langCode).trim() : undefined,
      link: row.link ? String(row.link).trim() : undefined,
      sourceFileName,
      sourceRowNumber: rowNumber,
      bulkRequestId: this.bulkRequest.id.getValue(),
      metadata,
      isVisible: !this.hasMultimediaUrls(row),
    };

    const result = await this.commandBus.execute(
      new UpsertProductCatalogCommand(
        createDto,
        this.context.companyId,
        this.context.userId,
        createDto.isVisible, // isVisible: false if has multimedia URLs
        false,
        true,
      ),
    );

    return result.id;
  }

  private async logRow(rowNumber: number, res: IExcelValidationResult, entityId?: string) {
    if (!res.isValid || res.warnings.length) {
      const rowLog: IBulkProcessingRowLog = {
        rowNumber,
        entityId,
        entityType: 'ProductCatalog',
        errors: res.errors,
        warnings: res.warnings,
        metadata: res.metadata,
        processedAt: new Date(),
      };
      this.bulkRequest.addRowLog(rowLog);
      await this.bulkProcessingRequestRepository.update(this.bulkRequest);
    }
  }
}
