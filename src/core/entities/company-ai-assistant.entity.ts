import { AggregateRoot } from '@core/events/domain-event.base';

export interface ICompanyAIAssistantFeature {
  id: string;
  featureId: string;
  enabled: boolean;
}

export interface ICompanyAIAssistantProps {
  id: string;
  companyId: string;
  aiAssistantId: string;
  enabled: boolean;
  features: ICompanyAIAssistantFeature[];
  createdAt: Date;
  updatedAt: Date;
}

// Type aliases for backward compatibility
export type CompanyAIAssistantFeature = ICompanyAIAssistantFeature;
export type CompanyAIAssistantProps = ICompanyAIAssistantProps;

export class CompanyAIAssistant extends AggregateRoot {
  private readonly _id: string;
  private readonly _companyId: string;
  private readonly _aiAssistantId: string;
  private _enabled: boolean;
  private _features: ICompanyAIAssistantFeature[];
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  constructor(props: ICompanyAIAssistantProps) {
    super();
    this._id = props.id;
    this._companyId = props.companyId;
    this._aiAssistantId = props.aiAssistantId;
    this._enabled = props.enabled;
    this._features = props.features;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }
  get id(): string {
    return this._id;
  }

  get companyId(): string {
    return this._companyId;
  }

  get aiAssistantId(): string {
    return this._aiAssistantId;
  }

  get enabled(): boolean {
    return this._enabled;
  }

  get features(): ICompanyAIAssistantFeature[] {
    return this._features;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  public toggleEnabled(): void {
    this._enabled = !this._enabled;
    this._updatedAt = new Date();
  }

  public updateFeatureStatus(featureId: string, enabled: boolean): void {
    const feature = this._features.find(f => f.featureId === featureId);
    if (feature) {
      feature.enabled = enabled;
      this._updatedAt = new Date();
    }
  }

  public static create(
    props: Omit<ICompanyAIAssistantProps, 'createdAt' | 'updatedAt'>,
  ): CompanyAIAssistant {
    return new CompanyAIAssistant({
      ...props,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
}
