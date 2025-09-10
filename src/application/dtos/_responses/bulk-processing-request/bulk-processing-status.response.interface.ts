import { BulkProcessingStatus } from '@shared/constants/bulk-processing-status.enum';

/**
 * Response interface for bulk processing status endpoint
 * Provides detailed status and progress information
 */
export interface IBulkProcessingStatusResponse {
  requestId: string;
  status: BulkProcessingStatus;
  progressPercentage: number;
  totalRows: number | null;
  processedRows: number;
  successfulRows: number;
  failedRows: number;
  hasErrors: boolean;
  startedAt: Date | null;
  completedAt: Date | null;
  errorMessage: string | null;
}
