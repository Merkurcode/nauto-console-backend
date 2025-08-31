import { DomainEvent } from './domain-event.base';
import { EntityId } from '@core/value-objects/entity-id.vo';
import { CompanyId } from '@core/value-objects/company-id.vo';

/**
 * AI Persona Domain Events
 * Following DDD: Events represent significant business moments in the AI Persona lifecycle
 */

export class AIPersonaCreatedEvent extends DomainEvent {
  constructor(
    public readonly personaId: EntityId,
    public readonly personaName: string,
    public readonly language: string,
    public readonly isActive: boolean,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'ai_persona.created';
  }
}

export class AIPersonaUpdatedEvent extends DomainEvent {
  constructor(
    public readonly personaId: EntityId,
    public readonly language: string,
    public readonly changes: {
      personaName?: string;
      description?: string;
      tone?: string;
      personalityTraits?: string[];
      communicationStyle?: string;
      vocabularyLevel?: string;
    },
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'ai_persona.updated';
  }
}

export class AIPersonaActivatedEvent extends DomainEvent {
  constructor(
    public readonly personaId: EntityId,
    public readonly personaName: string,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'ai_persona.activated';
  }
}

export class AIPersonaDeactivatedEvent extends DomainEvent {
  constructor(
    public readonly personaId: EntityId,
    public readonly personaName: string,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'ai_persona.deactivated';
  }
}

export class AIPersonaDeletedEvent extends DomainEvent {
  constructor(
    public readonly personaId: EntityId,
    public readonly personaName: string,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'ai_persona.deleted';
  }
}

export class AIPersonaAssignedToCompanyEvent extends DomainEvent {
  constructor(
    public readonly personaId: EntityId,
    public readonly companyId: CompanyId,
    public readonly personaName: string,
    public readonly isActive: boolean,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'ai_persona.assigned_to_company';
  }
}

export class AIPersonaRemovedFromCompanyEvent extends DomainEvent {
  constructor(
    public readonly personaId: EntityId,
    public readonly companyId: CompanyId,
    public readonly personaName: string,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'ai_persona.removed_from_company';
  }
}

export class AIPersonaLanguageAddedEvent extends DomainEvent {
  constructor(
    public readonly personaId: EntityId,
    public readonly language: string,
    public readonly languageData: Record<string, unknown>,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'ai_persona.language_added';
  }
}

export class AIPersonaLanguageRemovedEvent extends DomainEvent {
  constructor(
    public readonly personaId: EntityId,
    public readonly language: string,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'ai_persona.language_removed';
  }
}

export class AIPersonaLanguageUpdatedEvent extends DomainEvent {
  constructor(
    public readonly personaId: EntityId,
    public readonly language: string,
    public readonly updatedData: Record<string, unknown>,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'ai_persona.language_updated';
  }
}

export class AIPersonaDefaultSetEvent extends DomainEvent {
  constructor(
    public readonly personaId: EntityId,
    public readonly companyId: CompanyId,
    public readonly previousDefaultId?: EntityId,
    public readonly timestamp?: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'ai_persona.default_set';
  }
}

export class AIPersonaCompanyStatusChangedEvent extends DomainEvent {
  constructor(
    public readonly personaId: EntityId,
    public readonly companyId: CompanyId,
    public readonly newStatus: boolean,
    public readonly previousStatus: boolean,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'ai_persona.company_status_changed';
  }
}

export class BulkAIPersonasCreatedEvent extends DomainEvent {
  constructor(
    public readonly personaIds: EntityId[],
    public readonly count: number,
    public readonly language: string,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'ai_persona.bulk_created';
  }
}
