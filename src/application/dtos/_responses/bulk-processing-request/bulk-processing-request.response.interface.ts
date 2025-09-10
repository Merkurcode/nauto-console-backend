/* eslint-disable @typescript-eslint/no-explicit-any */
import { IBulkProcessingRowLog } from '@core/entities/bulk-processing-request.entity';
import { BulkProcessingStatus } from '@shared/constants/bulk-processing-status.enum';
import { BulkProcessingType } from '@shared/constants/bulk-processing-type.enum';

export interface IBulkProcessingRequestResponse {
  id: string;
  type: BulkProcessingType;
  fileId: string;
  fileName: string;
  status: BulkProcessingStatus;
  jobId: string | null;
  totalRows: number | null;
  processedRows: number;
  successfulRows: number;
  failedRows: number;
  progressPercentage: number;
  errorMessage: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  companyId: string;
  requestedBy: string;
  createdAt: Date;
  updatedAt: Date;
  hasErrors: boolean;
  rowLogs: IBulkProcessingRowLog[];
  metadata?: Record<string, any>;
}
