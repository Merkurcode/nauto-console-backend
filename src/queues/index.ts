// Main module exports
export { QueueModule, IQueueModuleOptions } from './queue.module';

// Event Registry and Decorators
export {
  EventRegistry,
  HandlerRegistry,
  MQSerializableEvent,
  MQSerializableEventHandler,
} from './registry/event-registry';

// Event Validation
export { BaseEvent, validateEvent } from './validation/event-validation';

// Configuration
export { getQueueConfig } from './config/queue.config';

// Health Service
export { HealthService } from './health/health-checker.service';

// Event Bus
export { GenericEventBus } from './event-bus/generic-event-bus';
export { BaseEventBus } from './base/base-event-bus';

// Processor
export { BaseProcessor } from './base/base-processor';

// Controllers
export { QueueHealthController } from './controllers/queue-health.controller';

// Types
export * from './types';

// Examples (remove these in production)
export { UserCreatedEvent } from './examples/event-handlers/user-created.handler';
export { UserCreatedHandler } from './examples/event-handlers/user-created.handler';
