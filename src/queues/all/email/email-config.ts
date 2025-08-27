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

// Default configuration for backward compatibility
const _JobConfig: IJobConfig = {
  attempts: parseInt(process.env.EMAIL_QUEUE_ATTEMPTS || '8', 10),
  backoff: {
    type: 'exponential', // Changed to exponential for better retry pattern
    delay: 5000, // 5s initial delay, then exponentially increases
  },
  delay: parseInt(process.env.EMAIL_QUEUE_DELAY_MS || '2000', 10), // Configurable delay for SMTP rate limiting
  priority: 10, // Medium priority for email jobs
  // TTL-based cleanup optimized for Render deployment
  removeOnComplete: { 
    age: parseInt(process.env.EMAIL_QUEUE_COMPLETED_TTL_HOURS || '24', 10) * 60 * 60,
    count: parseInt(process.env.EMAIL_QUEUE_COMPLETED_COUNT || '500', 10)
  },
  removeOnFail: { 
    age: parseInt(process.env.EMAIL_QUEUE_FAILED_TTL_DAYS || '7', 10) * 24 * 60 * 60,
    count: parseInt(process.env.EMAIL_QUEUE_FAILED_COUNT || '100', 10)
  },
} as const;

const _QueueConfig: IQueueConfig = {
  name: 'auth-emails',
  retryWindowMs: parseInt(process.env.EMAIL_QUEUE_RETRY_WINDOW_HOURS || '2', 10) * 60 * 60 * 1000,
} as const;

const _ProcessorConfig: IProcessorConfig = {
  concurrency: parseInt(process.env.EMAIL_QUEUE_CONCURRENCY || '3', 10), // Configurable concurrency
  maxStalledCount: 3, // Máximo 3 jobs estancados
  stalledInterval: 30000, // 30s para detectar
} as const;

// Rate limiter configuration for SMTP-friendly email processing
export const EmailRateLimitConfig = {
  // SMTP provider limits (adjust based on your provider)
  maxEmailsPerMinute: 30, // Conservative limit for most SMTP providers
  maxEmailsPerHour: 500, // Hourly limit to prevent provider throttling
  
  // Delay between email batches to respect SMTP limits
  delayBetweenJobs: 2000, // 2 seconds between email jobs (30 emails/min)
  
  // Exponential backoff for rate limit errors
  rateLimitBackoff: {
    type: 'exponential' as const,
    delay: 10000, // Start with 10s delay when rate limited
    maxDelay: 300000, // Max 5 minutes delay
  },
  
  // Provider-specific settings (can be overridden by environment)
  providers: {
    smtp: { maxPerMinute: 30, maxPerHour: 500 },
    resend: { maxPerMinute: 100, maxPerHour: 10000 },
    mailgun: { maxPerMinute: 300, maxPerHour: 10000 },
    sendgrid: { maxPerMinute: 100, maxPerHour: 40000 },
  }
} as const;

export const ModuleConfig: IQueueModuleConfig = {
  jobs: _JobConfig,
  queue: _QueueConfig,
  processor: _ProcessorConfig,
} as const;
