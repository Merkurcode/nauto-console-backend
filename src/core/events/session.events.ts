import { DomainEvent } from './domain-event.base';
import { SessionId } from '@core/value-objects/session-id.vo';
import { UserId } from '@core/value-objects/user-id.vo';

export class SessionCreatedEvent extends DomainEvent {
  constructor(
    public readonly sessionId: SessionId,
    public readonly userId: UserId,
  ) {
    super();
  }

  getEventName(): string {
    return 'session.created';
  }
}

export class SessionRevokedEvent extends DomainEvent {
  constructor(
    public readonly sessionId: SessionId,
    public readonly userId: UserId,
  ) {
    super();
  }

  getEventName(): string {
    return 'session.revoked';
  }
}

export class SessionUpdatedEvent extends DomainEvent {
  constructor(
    public readonly sessionId: SessionId,
    public readonly userId: UserId,
  ) {
    super();
  }

  getEventName(): string {
    return 'session.updated';
  }
}