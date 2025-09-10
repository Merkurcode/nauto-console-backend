/* eslint-disable @typescript-eslint/no-explicit-any */
import { ApiProperty } from '@nestjs/swagger';
import { IBulkProcessingRowLog } from '@core/entities/bulk-processing-request.entity';
import { BulkProcessingStatus } from '@shared/constants/bulk-processing-status.enum';
import { BulkProcessingType } from '@shared/constants/bulk-processing-type.enum';
import { IBulkProcessingRequestResponse } from './bulk-processing-request.response.interface';

export class BulkProcessingRowLogResponse implements IBulkProcessingRowLog {
  @ApiProperty({ description: 'Row number in the Excel file' })
  rowNumber: number;

  @ApiProperty({ description: 'Entity ID (e.g., product ID)', required: false })
  entityId?: string;

  @ApiProperty({ description: 'Type of entity being processed', required: false })
  entityType?: string;

  @ApiProperty({ description: 'List of errors encountered', type: [String] })
  errors: string[];

  @ApiProperty({ description: 'List of warnings encountered', type: [String] })
  warnings: string[];

  @ApiProperty({ description: 'Additional metadata for the row', required: false })
  metadata?: Record<string, any>;

  @ApiProperty({ description: 'Timestamp when the row was processed' })
  processedAt: Date;
}

export class BulkProcessingRequestResponse implements IBulkProcessingRequestResponse {
  @ApiProperty({ description: 'Unique identifier for the bulk processing request' })
  id: string;

  @ApiProperty({ description: 'Type of bulk processing', enum: BulkProcessingType })
  type: BulkProcessingType;

  @ApiProperty({ description: 'ID of the uploaded file being processed' })
  fileId: string;

  @ApiProperty({ description: 'Name of the uploaded file' })
  fileName: string;

  @ApiProperty({ description: 'Current status of the processing', enum: BulkProcessingStatus })
  status: BulkProcessingStatus;

  @ApiProperty({ description: 'Queue job ID for tracking', nullable: true })
  jobId: string | null;

  @ApiProperty({ description: 'Total number of rows to process', nullable: true })
  totalRows: number | null;

  @ApiProperty({ description: 'Number of rows processed so far' })
  processedRows: number;

  @ApiProperty({ description: 'Number of rows processed successfully' })
  successfulRows: number;

  @ApiProperty({ description: 'Number of rows that failed processing' })
  failedRows: number;

  @ApiProperty({ description: 'Processing progress percentage (0-100)' })
  progressPercentage: number;

  @ApiProperty({ description: 'Error message if processing failed', nullable: true })
  errorMessage: string | null;

  @ApiProperty({ description: 'Timestamp when processing started', nullable: true })
  startedAt: Date | null;

  @ApiProperty({ description: 'Timestamp when processing completed', nullable: true })
  completedAt: Date | null;

  @ApiProperty({ description: 'Company ID that owns this request' })
  companyId: string;

  @ApiProperty({ description: 'User ID who requested the processing' })
  requestedBy: string;

  @ApiProperty({ description: 'Timestamp when the request was created' })
  createdAt: Date;

  @ApiProperty({ description: 'Timestamp when the request was last updated' })
  updatedAt: Date;

  @ApiProperty({ description: 'Whether the processing encountered any errors' })
  hasErrors: boolean;

  @ApiProperty({
    description: 'Detailed logs of rows that had errors or warnings',
    type: [BulkProcessingRowLogResponse],
  })
  rowLogs: IBulkProcessingRowLog[];

  @ApiProperty({ description: 'Additional metadata', required: false })
  metadata?: Record<string, any>;
}

// Re-export interfaces for backward compatibility
export { IBulkProcessingRequestResponse } from './bulk-processing-request.response.interface';
export { IBulkProcessingJobStatusResponse } from './bulk-processing-job-status.response.interface';
export { IBulkProcessingStatusResponse } from './bulk-processing-status.response.interface';
