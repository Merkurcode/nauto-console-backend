import { AggregateRoot } from '@core/events/domain-event.base';
import { CompanyAIAssistantFeatureId } from '@core/value-objects/company-ai-assistant-feature-id.vo';
import { AIAssistantFeatureId } from '@core/value-objects/ai-assistant-feature-id.vo';

export interface ICompanyAIAssistantFeatureProps {
  assignmentId: string; // CompanyAIAssistant ID
  featureId: AIAssistantFeatureId;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class CompanyAIAssistantFeature extends AggregateRoot {
  private constructor(
    private readonly _id: CompanyAIAssistantFeatureId,
    private readonly _props: ICompanyAIAssistantFeatureProps,
  ) {
    super();
  }

  public static create(
    props: Omit<ICompanyAIAssistantFeatureProps, 'createdAt' | 'updatedAt'>,
    id?: CompanyAIAssistantFeatureId,
  ): CompanyAIAssistantFeature {
    const now = new Date();
    const featureId = id || CompanyAIAssistantFeatureId.create();

    return new CompanyAIAssistantFeature(featureId, {
      ...props,
      createdAt: now,
      updatedAt: now,
    });
  }

  public static reconstruct(
    id: CompanyAIAssistantFeatureId,
    props: ICompanyAIAssistantFeatureProps,
  ): CompanyAIAssistantFeature {
    return new CompanyAIAssistantFeature(id, props);
  }

  // Getters
  public get id(): CompanyAIAssistantFeatureId {
    return this._id;
  }

  public get assignmentId(): string {
    return this._props.assignmentId;
  }

  public get featureId(): AIAssistantFeatureId {
    return this._props.featureId;
  }

  public get enabled(): boolean {
    return this._props.enabled;
  }

  public get createdAt(): Date {
    return this._props.createdAt;
  }

  public get updatedAt(): Date {
    return this._props.updatedAt;
  }

  // Business methods
  public enable(): void {
    if (!this._props.enabled) {
      this._props.enabled = true;
      this.touch();
    }
  }

  public disable(): void {
    if (this._props.enabled) {
      this._props.enabled = false;
      this.touch();
    }
  }

  public toggleEnabled(): void {
    this._props.enabled = !this._props.enabled;
    this.touch();
  }

  private touch(): void {
    this._props.updatedAt = new Date();
  }

  // Validation
  public isValid(): boolean {
    return (
      !!this._props.assignmentId &&
      this._props.assignmentId.trim().length > 0 &&
      !!this._props.featureId &&
      typeof this._props.enabled === 'boolean'
    );
  }
}
