import { AggregateRoot } from '@core/events/domain-event.base';
import { AssistantAreaEnum } from '../../shared/constants/enums';

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
    return new AIAssistant({
      ...props,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
}
