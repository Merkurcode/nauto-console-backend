import { DomainEvent } from '../domain-event.base';

export class AIPersonaDeactivatedEvent extends DomainEvent {
  constructor(
    public readonly aiPersonaId: string,
    public readonly name: string,
    public readonly companyId: string | null,
    public readonly deactivatedBy: string,
  ) {
    super();
  }

  getEventName(): string {
    return 'ai_persona.deactivated';
  }
}
