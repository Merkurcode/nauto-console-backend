import { AggregateRoot } from '@core/events/domain-event.base';
import { AssistantAreaEnum } from '../../shared/constants/enums';
import { AIAssistantId } from '@core/value-objects/ai-assistant-id.vo';
import {
  AIAssistantCreatedEvent,
  AIAssistantActivatedEvent,
  AIAssistantDeactivatedEvent,
} from '@core/events/ai-assistant.events';

export interface IAIAssistantFeature {
  id: string;
  keyName: string;
  title: Record<string, string>;
  description: Record<string, string>;
}

export interface IAIAssistantProps {
  id: string;
  name: string;
  area: AssistantAreaEnum;
  available: boolean;
  description: Record<string, string>;
  features: IAIAssistantFeature[];
  createdAt: Date;
  updatedAt: Date;
}

// Type aliases for backward compatibility
export type AIAssistantFeature = IAIAssistantFeature;
export type AIAssistantProps = IAIAssistantProps;

export class AIAssistant extends AggregateRoot {
  private readonly _id: string;
  private readonly _name: string;
  private readonly _area: AssistantAreaEnum;
  private _available: boolean;
  private readonly _description: Record<string, string>;
  private readonly _features: IAIAssistantFeature[];
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  constructor(props: IAIAssistantProps) {
    super();
    this._id = props.id;
    this._name = props.name;
    this._area = props.area;
    this._available = props.available;
    this._description = props.description;
    this._features = props.features;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }
  get id(): string {
    return this._id;
  }

  get name(): string {
    return this._name;
  }

  get area(): AssistantAreaEnum {
    return this._area;
  }

  get available(): boolean {
    return this._available;
  }

  get description(): Record<string, string> {
    return this._description;
  }

  get features(): IAIAssistantFeature[] {
    return this._features;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  public getLocalizedDescription(lang: string = 'en-US'): string {
    return this._description[lang] || this._description['en-US'] || '';
  }

  public getLocalizedFeature(
    feature: IAIAssistantFeature,
    lang: string = 'en-US',
  ): {
    title: string;
    description: string;
  } {
    return {
      title: feature.title[lang] || feature.title['en-US'] || '',
      description: feature.description[lang] || feature.description['en-US'] || '',
    };
  }

  public static create(props: Omit<IAIAssistantProps, 'createdAt' | 'updatedAt'>): AIAssistant {
    const aiAssistant = new AIAssistant({
      ...props,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    aiAssistant.addDomainEvent(
      new AIAssistantCreatedEvent(
        AIAssistantId.fromString(props.id),
        props.name,
        props.name, // displayName
        aiAssistant.getLocalizedDescription(),
        props.available,
        new Date(),
      ),
    );

    return aiAssistant;
  }

  public activate(): void {
    if (this._available) {
      return; // Already available, no change needed
    }

    this._available = true;
    this._updatedAt = new Date();

    this.addDomainEvent(
      new AIAssistantActivatedEvent(
        AIAssistantId.fromString(this._id),
        this._name,
        this._updatedAt,
      ),
    );
  }

  public deactivate(): void {
    if (!this._available) {
      return; // Already unavailable, no change needed
    }

    this._available = false;
    this._updatedAt = new Date();

    this.addDomainEvent(
      new AIAssistantDeactivatedEvent(
        AIAssistantId.fromString(this._id),
        this._name,
        this._updatedAt,
      ),
    );
  }

  public updateDescription(newDescription: Record<string, string>): void {
    // Update description (assuming it's mutable for this operation)
    Object.keys(this._description).forEach(key => delete this._description[key]);
    Object.assign(this._description, newDescription);

    this._updatedAt = new Date();
  }

  public updateFeatures(newFeatures: IAIAssistantFeature[]): void {
    // Update features (assuming it's mutable for this operation)
    this._features.length = 0;
    this._features.push(...newFeatures);

    this._updatedAt = new Date();
  }

  // Override toJSON to prevent private fields from being serialized
  public toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      name: this.name,
      area: this.area,
      available: this.available,
      description: this.description,
      features: this.features,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
