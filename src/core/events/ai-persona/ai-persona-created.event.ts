import { DomainEvent } from '../domain-event.base';

export class AIPersonaCreatedEvent extends DomainEvent {
  constructor(
    public readonly aiPersonaId: string,
    public readonly name: string,
    public readonly keyName: string,
    public readonly tone: Record<string, string>,
    public readonly personality: Record<string, string>,
    public readonly objective: Record<string, string>,
    public readonly shortDetails: Record<string, string>,
    public readonly isDefault: boolean,
    public readonly companyId: string | null,
    public readonly createdBy: string | null,
  ) {
    super();
  }

  getEventName(): string {
    return 'ai_persona.created';
  }
}
