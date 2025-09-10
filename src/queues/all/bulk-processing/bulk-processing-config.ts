import {
  BulkProcessingEventType,
  BulkProcessingType,
} from '@shared/constants/bulk-processing-type.enum';
import { IJobConfig, IProcessorConfig, IQueueConfig, IQueueModuleConfig } from '../../types';
import { IBulkProcessingFlatOptions } from '@core/interfaces/bulk-processing-options.interface';

export interface IBulkProcessingJobData {
  jobType: BulkProcessingType;
  requestId: string;
  eventType: BulkProcessingEventType;
  fileId: string;
  fileName: string;
  companyId: string;
  userId: string;
  options: IBulkProcessingFlatOptions;
  metadata?: Record<string, unknown>;
  timestamp: number;
  retryUntil: number;
  cancelled?: boolean;
  cancelledAt?: string;
  cancellationLogged?: boolean; // Flag to prevent duplicate cancellation logs
}

// Default configuration optimized for HIGH THROUGHPUT
const _JobConfig: IJobConfig = {
  attempts: parseInt(process.env.BULK_PROCESSING_ATTEMPTS || '3', 10),
  backoff: {
    type: 'exponential',
    delay: parseInt(process.env.BULK_PROCESSING_BACKOFF_DELAY || '10000', 10),
  },
  removeOnComplete: {
    age: 24 * 60 * 60,
    count: 10,
  },
  removeOnFail: {
    age: 5 * 24 * 60 * 60,
    count: 100,
  },
  timeout: parseInt(process.env.BULK_PROCESSING_JOB_TIMEOUT || '1800000', 10), // ~30 mins per job
} as const;

const _QueueConfig: IQueueConfig = {
  name: 'bulk-processing',
  retryWindowMs: 5000,
} as const;

const _ProcessorConfig: IProcessorConfig = {
  concurrency: parseInt(process.env.BULK_PROCESSING_CONCURRENCY || '1', 10),
  maxStalledCount: 1,
  stalledInterval: 30000,
} as const;

export const ModuleConfig: IQueueModuleConfig = {
  jobs: _JobConfig,
  queue: _QueueConfig,
  processor: _ProcessorConfig,
} as const;
