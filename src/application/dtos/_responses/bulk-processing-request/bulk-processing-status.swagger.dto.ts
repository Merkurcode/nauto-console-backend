import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BulkProcessingStatus } from '@shared/constants/bulk-processing-status.enum';
import { IBulkProcessingStatusResponse } from './bulk-processing-status.response.interface';

export class BulkProcessingStatusSwaggerDto implements IBulkProcessingStatusResponse {
  @ApiProperty({
    description: 'UUID of the bulk processing request',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  requestId: string;

  @ApiProperty({
    description: 'Current processing status',
    enum: BulkProcessingStatus,
    example: BulkProcessingStatus.PROCESSING,
  })
  status: BulkProcessingStatus;

  @ApiProperty({
    description: 'Processing progress as percentage (0-100)',
    minimum: 0,
    maximum: 100,
    example: 75.5,
  })
  progressPercentage: number;

  @ApiPropertyOptional({
    description: 'Total number of rows to process (null until processing starts)',
    example: 1000,
    nullable: true,
  })
  totalRows: number | null;

  @ApiProperty({
    description: 'Number of rows processed so far',
    minimum: 0,
    example: 755,
  })
  processedRows: number;

  @ApiProperty({
    description: 'Number of rows processed successfully',
    minimum: 0,
    example: 720,
  })
  successfulRows: number;

  @ApiProperty({
    description: 'Number of rows that failed processing',
    minimum: 0,
    example: 35,
  })
  failedRows: number;

  @ApiProperty({
    description: 'Whether any processing errors occurred',
    example: true,
  })
  hasErrors: boolean;

  @ApiPropertyOptional({
    description: 'When processing started (null if not started)',
    type: 'string',
    format: 'date-time',
    example: '2024-01-01T10:00:00Z',
    nullable: true,
  })
  startedAt: Date | null;

  @ApiPropertyOptional({
    description: 'When processing completed (null if still running)',
    type: 'string',
    format: 'date-time',
    example: null,
    nullable: true,
  })
  completedAt: Date | null;

  @ApiPropertyOptional({
    description: 'General error message if processing failed',
    example: null,
    nullable: true,
  })
  errorMessage: string | null;
}
