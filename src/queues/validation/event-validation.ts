export class BaseEvent {
  constructor(public readonly aggregateId: string) {}
}

export function validateEvent(event: Record<string, unknown>): void {
  if (!event || typeof event !== 'object') {
    throw new Error('Event must be an object');
  }

  if (Array.isArray(event)) {
    throw new Error('Event cannot be an array');
  }

  const eventString = JSON.stringify(event);
  const maxBytes = parseInt(process.env.EVENT_MAX_BYTES || '262144', 10); // 256KB default

  if (Buffer.byteLength(eventString, 'utf8') > maxBytes) {
    throw new Error(`Event size exceeds maximum allowed size of ${maxBytes} bytes`);
  }

  if (!event.__eventName && !event.eventName) {
    throw new Error('Event must have an event name');
  }
}
