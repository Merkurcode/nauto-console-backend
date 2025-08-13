import { DomainEvent } from '../domain-event.base';

export class AIPersonaUpdatedEvent extends DomainEvent {
  constructor(
    public readonly aiPersonaId: string,
    public readonly name: string,
    public readonly tone: Record<string, string>,
    public readonly personality: Record<string, string>,
    public readonly objective: Record<string, string>,
    public readonly shortDetails: Record<string, string>,
    public readonly updatedBy: string,
  ) {
    super();
  }

  getEventName(): string {
    return 'ai_persona.updated';
  }
}
