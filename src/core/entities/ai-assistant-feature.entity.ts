import { AggregateRoot } from '@core/events/domain-event.base';
import { AIAssistantFeatureId } from '@core/value-objects/ai-assistant-feature-id.vo';
import { AIAssistantId } from '@core/value-objects/ai-assistant-id.vo';

export interface IAIAssistantFeatureProps {
  keyName: string;
  title: Record<string, string>;
  description: Record<string, string>;
  aiAssistantId: AIAssistantId;
  createdAt: Date;
  updatedAt: Date;
}

export class AIAssistantFeature extends AggregateRoot {
  private constructor(
    private readonly _id: AIAssistantFeatureId,
    private readonly _props: IAIAssistantFeatureProps,
  ) {
    super();
  }

  public static create(
    props: Omit<IAIAssistantFeatureProps, 'createdAt' | 'updatedAt'>,
    id?: AIAssistantFeatureId,
  ): AIAssistantFeature {
    const now = new Date();
    const featureId = id || AIAssistantFeatureId.create();

    return new AIAssistantFeature(featureId, {
      ...props,
      createdAt: now,
      updatedAt: now,
    });
  }

  public static reconstruct(
    id: AIAssistantFeatureId,
    props: IAIAssistantFeatureProps,
  ): AIAssistantFeature {
    return new AIAssistantFeature(id, props);
  }

  // Getters
  public get id(): AIAssistantFeatureId {
    return this._id;
  }

  public get keyName(): string {
    return this._props.keyName;
  }

  public get title(): Record<string, string> {
    return { ...this._props.title };
  }

  public get description(): Record<string, string> {
    return { ...this._props.description };
  }

  public get aiAssistantId(): AIAssistantId {
    return this._props.aiAssistantId;
  }

  public get createdAt(): Date {
    return this._props.createdAt;
  }

  public get updatedAt(): Date {
    return this._props.updatedAt;
  }

  // Business methods
  public updateTitle(title: Record<string, string>): void {
    this._props.title = { ...title };
    this.touch();
  }

  public updateDescription(description: Record<string, string>): void {
    this._props.description = { ...description };
    this.touch();
  }

  public updateKeyName(keyName: string): void {
    this._props.keyName = keyName;
    this.touch();
  }

  private touch(): void {
    this._props.updatedAt = new Date();
  }

  // Validation
  public isValid(): boolean {
    return (
      !!this._props.keyName &&
      this._props.keyName.trim().length > 0 &&
      !!this._props.title &&
      Object.keys(this._props.title).length > 0 &&
      !!this._props.description &&
      Object.keys(this._props.description).length > 0 &&
      !!this._props.aiAssistantId
    );
  }
}
