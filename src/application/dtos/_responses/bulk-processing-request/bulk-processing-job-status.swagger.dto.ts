import { ApiProperty } from '@nestjs/swagger';
import { IBulkProcessingJobStatusResponse } from './bulk-processing-job-status.response.interface';

export class BulkProcessingJobStatusSwaggerDto implements IBulkProcessingJobStatusResponse {
  @ApiProperty({
    description: 'BullMQ job ID for tracking the background processing',
    example: 'job_1234567890',
  })
  jobId: string;

  @ApiProperty({
    description: 'Current status of the queued job',
    example: 'queued',
    enum: ['queued', 'active', 'completed', 'failed', 'delayed'],
  })
  status: string;
}
