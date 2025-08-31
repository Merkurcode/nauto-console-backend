import { DomainEvent } from './domain-event.base';
import { CompanyAIAssistantFeatureId } from '@core/value-objects/company-ai-assistant-feature-id.vo';
import { CompanyId } from '@core/value-objects/company-id.vo';
import { AIAssistantId } from '@core/value-objects/ai-assistant-id.vo';
import { AIAssistantFeatureId } from '@core/value-objects/ai-assistant-feature-id.vo';

/**
 * Company AI Assistant Feature Domain Events
 * Following DDD: Events represent significant business moments in the Company AI Assistant Feature lifecycle
 */

export class CompanyAIAssistantFeatureCreatedEvent extends DomainEvent {
  constructor(
    public readonly id: CompanyAIAssistantFeatureId,
    public readonly companyId: CompanyId,
    public readonly assistantId: AIAssistantId,
    public readonly featureId: AIAssistantFeatureId,
    public readonly isActive: boolean,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'company_ai_assistant_feature.created';
  }
}

export class CompanyAIAssistantFeatureUpdatedEvent extends DomainEvent {
  constructor(
    public readonly id: CompanyAIAssistantFeatureId,
    public readonly companyId: CompanyId,
    public readonly assistantId: AIAssistantId,
    public readonly featureId: AIAssistantFeatureId,
    public readonly changes: {
      isActive?: boolean;
    },
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'company_ai_assistant_feature.updated';
  }
}

export class CompanyAIAssistantFeatureActivatedEvent extends DomainEvent {
  constructor(
    public readonly id: CompanyAIAssistantFeatureId,
    public readonly companyId: CompanyId,
    public readonly assistantId: AIAssistantId,
    public readonly featureId: AIAssistantFeatureId,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'company_ai_assistant_feature.activated';
  }
}

export class CompanyAIAssistantFeatureDeactivatedEvent extends DomainEvent {
  constructor(
    public readonly id: CompanyAIAssistantFeatureId,
    public readonly companyId: CompanyId,
    public readonly assistantId: AIAssistantId,
    public readonly featureId: AIAssistantFeatureId,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'company_ai_assistant_feature.deactivated';
  }
}

export class CompanyAIAssistantFeatureDeletedEvent extends DomainEvent {
  constructor(
    public readonly id: CompanyAIAssistantFeatureId,
    public readonly companyId: CompanyId,
    public readonly assistantId: AIAssistantId,
    public readonly featureId: AIAssistantFeatureId,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'company_ai_assistant_feature.deleted';
  }
}

export class BulkCompanyAIAssistantFeaturesCreatedEvent extends DomainEvent {
  constructor(
    public readonly companyId: CompanyId,
    public readonly featureIds: CompanyAIAssistantFeatureId[],
    public readonly count: number,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'company_ai_assistant_feature.bulk_created';
  }
}

export class CompanyAIAssistantFeaturesStatusChangedEvent extends DomainEvent {
  constructor(
    public readonly companyId: CompanyId,
    public readonly assistantId: AIAssistantId,
    public readonly enabledFeatures: AIAssistantFeatureId[],
    public readonly disabledFeatures: AIAssistantFeatureId[],
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'company_ai_assistant_feature.status_changed';
  }
}
