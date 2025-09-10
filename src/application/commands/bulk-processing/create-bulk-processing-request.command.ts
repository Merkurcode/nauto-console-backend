import { ICommand, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { BulkProcessingRequest } from '@core/entities/bulk-processing-request.entity';
import { BulkProcessingType } from '@shared/constants/bulk-processing-type.enum';
import { IBulkProcessingRequestRepository } from '@core/repositories/bulk-processing-request.repository.interface';
import { IFileRepository } from '@core/repositories/file.repository.interface';
import {
  BULK_PROCESSING_REQUEST_REPOSITORY,
  FILE_REPOSITORY,
  LOGGER_SERVICE,
} from '@shared/constants/tokens';
import { EntityNotFoundException } from '@core/exceptions/domain-exceptions';
import {
  InvalidBulkProcessingFileException,
  UnauthorizedBulkProcessingRequestAccessException,
} from '@core/exceptions/bulk-processing.exceptions';
import { ILogger } from '@core/interfaces/logger.interface';
import { IBulkProcessingRequestResponse } from '@application/dtos/_responses/bulk-processing-request/bulk-processing-request.response.interface';
import { BulkProcessingRequestMapper } from '@application/mappers/bulk-processing-request.mapper';
import { FileLockService } from '@core/services/file-lock.service';
import { StartBulkProcessingHandler } from './start-bulk-processing.command';
import { FileStatus } from '@shared/constants/file-status.enum';

export class CreateBulkProcessingRequestCommand implements ICommand {
  constructor(
    public readonly type: BulkProcessingType,
    public readonly fileId: string,
    public readonly companyId: string,
    public readonly requestedBy: string,
  ) {}
}

@CommandHandler(CreateBulkProcessingRequestCommand)
export class CreateBulkProcessingRequestHandler
  implements ICommandHandler<CreateBulkProcessingRequestCommand, IBulkProcessingRequestResponse>
{
  constructor(
    @Inject(BULK_PROCESSING_REQUEST_REPOSITORY)
    private readonly bulkProcessingRequestRepository: IBulkProcessingRequestRepository,
    @Inject(FILE_REPOSITORY)
    private readonly fileRepository: IFileRepository,
    @Inject(LOGGER_SERVICE)
    private readonly logger: ILogger,
    private readonly fileLockService: FileLockService,
  ) {
    this.logger.setContext(CreateBulkProcessingRequestHandler.name);
  }

  async execute(
    command: CreateBulkProcessingRequestCommand,
  ): Promise<IBulkProcessingRequestResponse> {
    const { type, fileId, companyId, requestedBy } = command;

    if (StartBulkProcessingHandler.isReserved(type)) {
      throw new UnauthorizedBulkProcessingRequestAccessException(type, companyId);
    }

    // Use file lock to ensure exclusive access during bulk processing request creation
    return this.fileLockService.withFileLock(
      fileId,
      async () => {
        // Validate file exists and belongs to company
        const file = await this.fileRepository.findById(fileId);
        if (!file) {
          throw new EntityNotFoundException('File', fileId);
        }

        // Validate file status - only allow UPLOADED files
        if (!file.status.isUploaded()) {
          throw new InvalidBulkProcessingFileException(
            file.filename,
            `File must be in ${FileStatus.UPLOADED} status to be used for bulk processing. Current status: ${file.status.getValue()}`,
          );
        }

        // Validate file type
        this.validateFileForBulkProcessing(file.filename, file.mimeType);

        // Create bulk processing request
        const bulkRequest = BulkProcessingRequest.create({
          type,
          fileId,
          fileName: file.filename,
          companyId,
          requestedBy,
        });

        // Save to repository
        const savedRequest = await this.bulkProcessingRequestRepository.create(bulkRequest);

        this.logger.log(
          `Created bulk processing request: ${savedRequest.id.getValue()} ` +
            `for file: ${file.filename} (type: ${type}, company: ${companyId}, by: ${requestedBy})`,
        );

        return BulkProcessingRequestMapper.toResponse(savedRequest);
      },
      30000, // 30 seconds timeout for lock
      {
        acquireTimeoutMs: 30000, // Wait up to 5 seconds to acquire the lock
        retryDelayMs: 100, // Retry every 100ms
      },
    );
  }

  private validateFileForBulkProcessing(fileName: string, mimeType: string): void {
    const validMimeTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      //'text/csv', // .csv
    ];

    const validExtensions = ['.xlsx', '.xls' /*, '.csv'*/];
    const fileExtension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));

    if (!validMimeTypes.includes(mimeType) && !validExtensions.includes(fileExtension)) {
      throw new InvalidBulkProcessingFileException(
        fileName,
        `Unsupported file type. Supported formats: Excel (.xlsx, .xls)`,
        //`Unsupported file type. Supported formats: Excel (.xlsx, .xls) and CSV (.csv)`,
      );
    }

    // Additional file size validation could be added here
    // For now, we rely on the file upload system to enforce limits
  }
}
