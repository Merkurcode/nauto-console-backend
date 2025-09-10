import { ApiProperty } from '@nestjs/swagger';
import { IBulkProcessingJobData } from '@queues/all/bulk-processing/bulk-processing-config';

export class BulkProcessingQueueJobStatusSwaggerDto {
  @ApiProperty({
    description: 'Whether the job exists in the queue',
    example: true,
  })
  exists: boolean;

  @ApiProperty({
    description: 'The job ID in the queue system',
    example: 'bulk-processing:product-catalog:abc123-def456',
  })
  jobId: string;

  @ApiProperty({
    description: 'Current state of the job',
    example: 'active',
    enum: ['waiting', 'active', 'completed', 'failed', 'delayed', 'stalled'],
    required: false,
  })
  state?: string;

  @ApiProperty({
    description: 'Job progress percentage (0-100)',
    example: 75,
    required: false,
  })
  progress?: number;

  @ApiProperty({
    description: 'Job data payload',
    example: {
      jobType: 'PRODUCT_CATALOG',
      requestId: 'uuid-here',
      eventType: 'PROCESS_PRODUCT_CATALOG',
      fileId: 'file-uuid',
      fileName: 'products.xlsx',
      companyId: 'company-uuid',
      userId: 'user-uuid',
      options: {},
      metadata: {
        jobId: 'bulk-processing:product-catalog:abc123-def456',
        queueName: 'bulk-processing',
        enqueuedAt: '2025-01-10T10:30:00Z',
      },
      timestamp: 1704879000000,
      retryUntil: 1704900600000,
    },
    required: false,
  })
  data?: IBulkProcessingJobData;

  @ApiProperty({
    description: 'Timestamp when job was finished (completed or failed)',
    example: 1704879600000,
    required: false,
  })
  finishedOn?: number;

  @ApiProperty({
    description: 'Timestamp when job processing started',
    example: 1704879300000,
    required: false,
  })
  processedOn?: number;

  @ApiProperty({
    description: 'Failure reason if job failed',
    example: 'File not found or corrupted',
    required: false,
  })
  failedReason?: string;
}
