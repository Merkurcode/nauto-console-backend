/* eslint-disable prettier/prettier */
import { IJobConfig, IProcessorConfig, IQueueConfig, IQueueModuleConfig } from "src/queues/types";
import { ConfigService } from '@nestjs/config';


// Factory function to create configuration using ConfigService
export const createEmailQueueConfig = (configService?: ConfigService): IQueueModuleConfig => {
  // Fallback to environment variables if ConfigService is not available
  const getConfig = <T>(path: string, defaultValue: T): T => {
    if (configService) {
      return configService.get<T>(path) ?? defaultValue;
    }

    return defaultValue;
  };

  const _JobConfig: IJobConfig = {
    attempts: getConfig<number>('queue.email.attempts', 8),
    backoff: {
      type: 'exponential', // Changed to exponential for better retry pattern
      delay: 5000, // 5s initial delay, then exponentially increases
    },
    delay: getConfig<number>('queue.email.delayBetweenJobs', 2000), // Configurable delay for SMTP rate limiting
    priority: 10, // Medium priority for email jobs
    // TTL-based cleanup optimized for Render deployment
    removeOnComplete: { 
      age: getConfig<number>('queue.email.removeCompletedAge', 24 * 60 * 60),
      count: getConfig<number>('queue.email.removeCompletedCount', 500)
    },
    removeOnFail: { 
      age: getConfig<number>('queue.email.removeFailedAge', 7 * 24 * 60 * 60),
      count: getConfig<number>('queue.email.removeFailedCount', 100)
    },
  } as const;

  const _QueueConfig: IQueueConfig = {
    name: 'auth-emails',
    retryWindowMs: getConfig<number>('queue.email.retryWindowHours', 2) * 60 * 60 * 1000,
  } as const;

  const _ProcessorConfig: IProcessorConfig = {
    concurrency: getConfig<number>('queue.email.concurrency', 3), // Configurable concurrency
    maxStalledCount: 3, // Máximo 3 jobs estancados
    stalledInterval: 30000, // 30s para detectar
  } as const;

  return {
    jobs: _JobConfig,
    queue: _QueueConfig,
    processor: _ProcessorConfig,
  };
};

// Default configuration optimized for HIGH THROUGHPUT
const _JobConfig: IJobConfig = {
  attempts: parseInt(process.env.EMAIL_QUEUE_ATTEMPTS || '8', 10),
  backoff: {
    type: 'exponential', // Exponential backoff for smart retry pattern
    delay: 3000, // Reduced from 5s to 3s for faster retries
  },
  delay: parseInt(process.env.EMAIL_QUEUE_DELAY_MS || '500', 10), // RESEND OPTIMAL: 500ms = 2 rps
  priority: 10, // Medium priority for email jobs
  // TTL-based cleanup optimized for high-volume processing
  removeOnComplete: { 
    age: parseInt(process.env.EMAIL_QUEUE_COMPLETED_TTL_HOURS || '24', 10) * 60 * 60,
    count: parseInt(process.env.EMAIL_QUEUE_COMPLETED_COUNT || '1000', 10) // 500→1000
  },
  removeOnFail: { 
    age: parseInt(process.env.EMAIL_QUEUE_FAILED_TTL_DAYS || '7', 10) * 24 * 60 * 60,
    count: parseInt(process.env.EMAIL_QUEUE_FAILED_COUNT || '200', 10) // 100→200
  },
} as const;

const _QueueConfig: IQueueConfig = {
  name: 'auth-emails',
  retryWindowMs: parseInt(process.env.EMAIL_QUEUE_RETRY_WINDOW_HOURS || '2', 10) * 60 * 60 * 1000,
} as const;

const _ProcessorConfig: IProcessorConfig = {
  concurrency: parseInt(process.env.EMAIL_QUEUE_CONCURRENCY || '2', 10), // RESEND LIMIT: 2 workers max for 2 rps
  maxStalledCount: 2, // Reduced from 3 to 2 for faster recovery
  stalledInterval: 20000, // Reduced from 30s to 20s for faster detection
} as const;

// Rate limiter configuration OPTIMIZED for RESEND API LIMITS
export const EmailRateLimitConfig = {
  // RESEND SPECIFIC: 2 requests per second = 120/min (distributed, not exactly per second)
  // But using batch endpoint (100 emails/request) = up to 12,000 emails/min theoretical
  maxEmailsPerMinute: 120, // 2 requests/sec * 60 = 120 requests/min (conservative)
  maxEmailsPerHour: 7200, // 120 * 60 = 7,200 requests/hour (within free tier limits)
  
  // RESEND OPTIMAL: ~500ms delay = 2 requests per second (distributed)
  delayBetweenJobs: 500, // 500ms = 2 requests/sec (respects Resend 2 rps limit)
  
  // Smart exponential backoff for 429 errors from Resend
  rateLimitBackoff: {
    type: 'exponential' as const,
    delay: 2000, // 2s initial delay for 429 recovery
    maxDelay: 60000, // 1min max delay (Resend headers should guide retry-after)
  },
  
  // Provider-specific settings ACCURATE for Resend API limits
  providers: {
    smtp: { maxPerMinute: 60, maxPerHour: 2000 },        // Standard SMTP
    resend: { 
      maxPerMinute: 120,      // 2 rps = 120 requests/min (ACTUAL Resend limit)
      maxPerHour: 7200,       // 120 * 60 = 7,200 requests/hour
      maxEmailsPerRequest: 100, // Batch endpoint supports 100 emails/call
      maxRecipientsPerEmail: 50, // Individual email max recipients
    },
    mailgun: { maxPerMinute: 500, maxPerHour: 20000 },   // Mailgun higher limits
    sendgrid: { maxPerMinute: 600, maxPerHour: 40000 },  // SendGrid highest limits
  }
} as const;

export const ModuleConfig: IQueueModuleConfig = {
  jobs: _JobConfig,
  queue: _QueueConfig,
  processor: _ProcessorConfig,
} as const;
