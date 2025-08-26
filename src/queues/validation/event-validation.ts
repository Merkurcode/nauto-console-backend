export class BaseEvent {
  constructor(public readonly aggregateId: string) {}
}

import { ConfigService } from '@nestjs/config';

let configService: ConfigService;
export function setConfigService(config: ConfigService) {
  configService = config;
}

export function validateEvent(event: Record<string, unknown>): void {
  if (!event || typeof event !== 'object') {
    throw new Error('Event must be an object');
  }

  if (Array.isArray(event)) {
    throw new Error('Event cannot be an array');
  }

  const eventString = JSON.stringify(event);
  const maxBytes = configService?.get<number>('queue.performance.eventMaxBytes', 262144) ?? 262144; // 256KB default

  if (Buffer.byteLength(eventString, 'utf8') > maxBytes) {
    throw new Error(`Event size exceeds maximum allowed size of ${maxBytes} bytes`);
  }

  if (!event.__eventName && !event.eventName) {
    throw new Error('Event must have an event name');
  }
}
