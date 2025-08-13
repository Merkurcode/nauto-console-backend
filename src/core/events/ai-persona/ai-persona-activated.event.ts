import { DomainEvent } from '../domain-event.base';

export class AIPersonaActivatedEvent extends DomainEvent {
  constructor(
    public readonly aiPersonaId: string,
    public readonly name: string,
    public readonly companyId: string | null,
    public readonly activatedBy: string,
  ) {
    super();
  }

  getEventName(): string {
    return 'ai_persona.activated';
  }
}
