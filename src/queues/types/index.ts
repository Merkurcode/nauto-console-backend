export interface IEventConstructor<T = unknown> {
  new (...args: any[]): T;
  __eventName?: string;
  __isSerializableEvent?: boolean;
}

export interface IHandlerConstructor<T = unknown> {
  new (...args: any[]): T;
  __handlesEvents?: string[];
  __isSerializableHandler?: boolean;
}

export interface IEventHandler {
  handle(event: any): Promise<void>;
}

export interface IRedisConfig {
  host: string;
  port: number;
  db?: number;
  username?: string;
  password?: string;
  tls?: {
    rejectUnauthorized?: boolean;
    servername?: string;
    checkServerIdentity?: () => undefined;
  };
}

export interface IQueueDefinition {
  name: string;
  processor?: IEventConstructor;
  eventBusAdapter?: IEventConstructor;
  streams?: {
    maxLen: number;
    approximate: boolean;
  };
}

export interface IQueueModuleConfig {
  processor: IProcessorConfig;
  jobs: IJobConfig;
  queue: IQueueConfig;
}

export interface IProcessorConfig {
  concurrency?: number;
  maxStalledCount?: number;
  stalledInterval?: number;
}

export interface IJobConfig {
  attempts?: number;
  backoff?: { type: 'fixed' | 'exponential'; delay: number } | number;
  delay?: number;
  priority?: number;
  removeOnComplete?: boolean | number | { age?: number; count?: number };
  removeOnFail?: boolean | number | { age?: number; count?: number };
  lifo?: boolean;
  timeout?: number;
}

export interface IQueueConfig {
  name: string;
  retryWindowMs?: number;
}

export interface IBaseJobData {
  jobId?: string;
  timestamp?: number;
  retryUntil?: number;
}

export interface IEventJobData extends IBaseJobData {
  eventName: string;

  payload: Record<string, any>;
  eventId: string;
  timestamp: number;
  retryUntil: number;
}

export interface IPublishOptions {
  priority?: number;
  delay?: number;
  attempts?: number;
  backoff?: { type: 'fixed' | 'exponential'; delay: number };
  useIdempotency?: boolean;
  isCritical?: boolean;
  jobId?: string;
  lifo?: boolean;
  removeOnComplete?: number | boolean;
  removeOnFail?: number | boolean;
}

export interface IHandlerProgress {
  doneHandlers: string[];
}
