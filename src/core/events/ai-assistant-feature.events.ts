import { DomainEvent } from './domain-event.base';
import { AIAssistantFeatureId } from '@core/value-objects/ai-assistant-feature-id.vo';

/**
 * AI Assistant Feature Domain Events
 * Following DDD: Events represent significant business moments in the AI Assistant Feature lifecycle
 */

export class AIAssistantFeatureCreatedEvent extends DomainEvent {
  constructor(
    public readonly featureId: AIAssistantFeatureId,
    public readonly featureName: string,
    public readonly description: string,
    public readonly isActive: boolean,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'ai_assistant_feature.created';
  }
}

export class AIAssistantFeatureUpdatedEvent extends DomainEvent {
  constructor(
    public readonly featureId: AIAssistantFeatureId,
    public readonly featureName: string,
    public readonly changes: {
      description?: string;
      isActive?: boolean;
    },
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'ai_assistant_feature.updated';
  }
}

export class AIAssistantFeatureActivatedEvent extends DomainEvent {
  constructor(
    public readonly featureId: AIAssistantFeatureId,
    public readonly featureName: string,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'ai_assistant_feature.activated';
  }
}

export class AIAssistantFeatureDeactivatedEvent extends DomainEvent {
  constructor(
    public readonly featureId: AIAssistantFeatureId,
    public readonly featureName: string,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'ai_assistant_feature.deactivated';
  }
}

export class AIAssistantFeatureDeletedEvent extends DomainEvent {
  constructor(
    public readonly featureId: AIAssistantFeatureId,
    public readonly featureName: string,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'ai_assistant_feature.deleted';
  }
}

export class BulkAIAssistantFeaturesCreatedEvent extends DomainEvent {
  constructor(
    public readonly featureIds: AIAssistantFeatureId[],
    public readonly count: number,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'ai_assistant_feature.bulk_created';
  }
}
