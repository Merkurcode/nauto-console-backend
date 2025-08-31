import { DomainEvent } from './domain-event.base';
import { AIAssistantId } from '@core/value-objects/ai-assistant-id.vo';
import { CompanyId } from '@core/value-objects/company-id.vo';

/**
 * AI Assistant Domain Events
 * Following DDD: Events represent significant business moments in the AI Assistant lifecycle
 */

export class AIAssistantCreatedEvent extends DomainEvent {
  constructor(
    public readonly assistantId: AIAssistantId,
    public readonly assistantName: string,
    public readonly displayName: string,
    public readonly description: string,
    public readonly isActive: boolean,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'ai_assistant.created';
  }
}

export class AIAssistantUpdatedEvent extends DomainEvent {
  constructor(
    public readonly assistantId: AIAssistantId,
    public readonly assistantName: string,
    public readonly changes: {
      displayName?: string;
      description?: string;
      avatarUrl?: string;
      primaryColor?: string;
      secondaryColor?: string;
    },
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'ai_assistant.updated';
  }
}

export class AIAssistantActivatedEvent extends DomainEvent {
  constructor(
    public readonly assistantId: AIAssistantId,
    public readonly assistantName: string,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'ai_assistant.activated';
  }
}

export class AIAssistantDeactivatedEvent extends DomainEvent {
  constructor(
    public readonly assistantId: AIAssistantId,
    public readonly assistantName: string,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'ai_assistant.deactivated';
  }
}

export class AIAssistantDeletedEvent extends DomainEvent {
  constructor(
    public readonly assistantId: AIAssistantId,
    public readonly assistantName: string,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'ai_assistant.deleted';
  }
}

export class AIAssistantAssignedToCompanyEvent extends DomainEvent {
  constructor(
    public readonly assistantId: AIAssistantId,
    public readonly companyId: CompanyId,
    public readonly assistantName: string,
    public readonly isActive: boolean,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'ai_assistant.assigned_to_company';
  }
}

export class AIAssistantRemovedFromCompanyEvent extends DomainEvent {
  constructor(
    public readonly assistantId: AIAssistantId,
    public readonly companyId: CompanyId,
    public readonly assistantName: string,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'ai_assistant.removed_from_company';
  }
}

export class AIAssistantFeatureEnabledEvent extends DomainEvent {
  constructor(
    public readonly assistantId: AIAssistantId,
    public readonly companyId: CompanyId,
    public readonly featureName: string,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'ai_assistant.feature_enabled';
  }
}

export class AIAssistantFeatureDisabledEvent extends DomainEvent {
  constructor(
    public readonly assistantId: AIAssistantId,
    public readonly companyId: CompanyId,
    public readonly featureName: string,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'ai_assistant.feature_disabled';
  }
}

export class AIAssistantStatusToggledEvent extends DomainEvent {
  constructor(
    public readonly assistantId: AIAssistantId,
    public readonly companyId: CompanyId,
    public readonly newStatus: boolean,
    public readonly previousStatus: boolean,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'ai_assistant.status_toggled';
  }
}

export class AIAssistantConfigurationUpdatedEvent extends DomainEvent {
  constructor(
    public readonly assistantId: AIAssistantId,
    public readonly configuration: Record<string, unknown>,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'ai_assistant.configuration_updated';
  }
}

export class BulkAIAssistantsAssignedEvent extends DomainEvent {
  constructor(
    public readonly companyId: CompanyId,
    public readonly assistantIds: AIAssistantId[],
    public readonly count: number,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'ai_assistant.bulk_assigned';
  }
}
