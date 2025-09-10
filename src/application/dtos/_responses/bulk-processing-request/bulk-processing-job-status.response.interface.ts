/**
 * Response interface for bulk processing job status operations
 * Used when starting bulk processing requests
 */
export interface IBulkProcessingJobStatusResponse {
  jobId: string;
  status: string;
}
