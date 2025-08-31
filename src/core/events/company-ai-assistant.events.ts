import { DomainEvent } from './domain-event.base';
import { EntityId } from '@core/value-objects/entity-id.vo';
import { CompanyId } from '@core/value-objects/company-id.vo';
import { AIAssistantId } from '@core/value-objects/ai-assistant-id.vo';

/**
 * Company AI Assistant Domain Events
 * Following DDD: Events represent significant business moments in the Company AI Assistant lifecycle
 */

export class CompanyAIAssistantCreatedEvent extends DomainEvent {
  constructor(
    public readonly id: EntityId,
    public readonly companyId: CompanyId,
    public readonly assistantId: AIAssistantId,
    public readonly isActive: boolean,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'company_ai_assistant.created';
  }
}

export class CompanyAIAssistantUpdatedEvent extends DomainEvent {
  constructor(
    public readonly id: EntityId,
    public readonly companyId: CompanyId,
    public readonly assistantId: AIAssistantId,
    public readonly changes: {
      isActive?: boolean;
    },
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'company_ai_assistant.updated';
  }
}

export class CompanyAIAssistantActivatedEvent extends DomainEvent {
  constructor(
    public readonly id: EntityId,
    public readonly companyId: CompanyId,
    public readonly assistantId: AIAssistantId,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'company_ai_assistant.activated';
  }
}

export class CompanyAIAssistantDeactivatedEvent extends DomainEvent {
  constructor(
    public readonly id: EntityId,
    public readonly companyId: CompanyId,
    public readonly assistantId: AIAssistantId,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'company_ai_assistant.deactivated';
  }
}

export class CompanyAIAssistantDeletedEvent extends DomainEvent {
  constructor(
    public readonly id: EntityId,
    public readonly companyId: CompanyId,
    public readonly assistantId: AIAssistantId,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'company_ai_assistant.deleted';
  }
}

export class BulkCompanyAIAssistantsCreatedEvent extends DomainEvent {
  constructor(
    public readonly companyId: CompanyId,
    public readonly assistantIds: AIAssistantId[],
    public readonly count: number,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'company_ai_assistant.bulk_created';
  }
}

export class CompanyAIAssistantsStatusChangedEvent extends DomainEvent {
  constructor(
    public readonly companyId: CompanyId,
    public readonly enabledAssistants: AIAssistantId[],
    public readonly disabledAssistants: AIAssistantId[],
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'company_ai_assistant.status_changed';
  }
}
