import { AggregateRoot } from '@core/events/domain-event.base';
import { AIPersonaName } from '../value-objects/ai-persona-name.vo';
import { AIPersonaTone } from '../value-objects/ai-persona-tone.vo';
import { AIPersonaPersonality } from '../value-objects/ai-persona-personality.vo';
import { AIPersonaObjective } from '../value-objects/ai-persona-objective.vo';
import { AIPersonaShortDetails } from '../value-objects/ai-persona-short-details.vo';
import { AIPersonaKeyName } from '../value-objects/ai-persona-key-name.vo';
import { AIPersonaCreatedEvent } from '../events/ai-persona/ai-persona-created.event';
import { AIPersonaUpdatedEvent } from '../events/ai-persona/ai-persona-updated.event';
import { AIPersonaDeactivatedEvent } from '../events/ai-persona/ai-persona-deactivated.event';
import { AIPersonaActivatedEvent } from '../events/ai-persona/ai-persona-activated.event';

export interface IAIPersonaProps {
  name: AIPersonaName;
  keyName: AIPersonaKeyName;
  tone: AIPersonaTone;
  personality: AIPersonaPersonality;
  objective: AIPersonaObjective;
  shortDetails: AIPersonaShortDetails;
  isDefault: boolean;
  companyId?: string | null;
  isActive: boolean;
  createdBy?: string | null;
  updatedBy?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export class AIPersona extends AggregateRoot {
  private readonly _id: string;
  private readonly _name: AIPersonaName;
  private readonly _keyName: AIPersonaKeyName;
  private _tone: AIPersonaTone;
  private _personality: AIPersonaPersonality;
  private _objective: AIPersonaObjective;
  private _shortDetails: AIPersonaShortDetails;
  private readonly _isDefault: boolean;
  private _companyId: string | null;
  private _isActive: boolean;
  private _createdBy: string | null;
  private _updatedBy: string | null;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  private constructor(
    id: string,
    name: AIPersonaName,
    keyName: AIPersonaKeyName,
    tone: AIPersonaTone,
    personality: AIPersonaPersonality,
    objective: AIPersonaObjective,
    shortDetails: AIPersonaShortDetails,
    isDefault: boolean,
    companyId: string | null,
    isActive: boolean,
    createdBy: string | null,
    updatedBy: string | null,
    createdAt: Date,
    updatedAt: Date,
  ) {
    super();
    this._id = id;
    this._name = name;
    this._keyName = keyName;
    this._tone = tone;
    this._personality = personality;
    this._objective = objective;
    this._shortDetails = shortDetails;
    this._isDefault = isDefault;
    this._companyId = companyId;
    this._isActive = isActive;
    this._createdBy = createdBy;
    this._updatedBy = updatedBy;
    this._createdAt = createdAt;
    this._updatedAt = updatedAt;
  }

  public static create(props: Omit<IAIPersonaProps, 'createdAt' | 'updatedAt'>): AIPersona {
    const id = this.generateId();
    const now = new Date();

    const aiPersona = new AIPersona(
      id,
      props.name,
      props.keyName,
      props.tone,
      props.personality,
      props.objective,
      props.shortDetails,
      props.isDefault,
      props.companyId || null,
      props.isActive,
      props.createdBy || null,
      props.updatedBy || null,
      now,
      now,
    );

    aiPersona.addDomainEvent(
      new AIPersonaCreatedEvent(
        id,
        props.name.getValue(),
        props.keyName.getValue(),
        props.tone.getValue(),
        props.personality.getValue(),
        props.objective.getValue(),
        props.shortDetails.getValue(),
        props.isDefault,
        props.companyId || null,
        props.createdBy || null,
      ),
    );

    return aiPersona;
  }

  public static fromPersistence(id: string, props: IAIPersonaProps): AIPersona {
    return new AIPersona(
      id,
      props.name,
      props.keyName,
      props.tone,
      props.personality,
      props.objective,
      props.shortDetails,
      props.isDefault,
      props.companyId || null,
      props.isActive,
      props.createdBy || null,
      props.updatedBy || null,
      props.createdAt || new Date(),
      props.updatedAt || new Date(),
    );
  }

  private static generateId(): string {
    return crypto.randomUUID();
  }

  public update(
    tone: AIPersonaTone,
    personality: AIPersonaPersonality,
    objective: AIPersonaObjective,
    shortDetails: AIPersonaShortDetails,
    updatedBy: string,
  ): void {
    const hasChanges =
      !this._tone.equals(tone) ||
      !this._personality.equals(personality) ||
      !this._objective.equals(objective) ||
      !this._shortDetails.equals(shortDetails);

    if (!hasChanges) {
      return;
    }

    this._tone = tone;
    this._personality = personality;
    this._objective = objective;
    this._shortDetails = shortDetails;
    this._updatedBy = updatedBy;
    this._updatedAt = new Date();

    this.addDomainEvent(
      new AIPersonaUpdatedEvent(
        this._id,
        this._name.getValue(),
        tone.getValue(),
        personality.getValue(),
        objective.getValue(),
        shortDetails.getValue(),
        updatedBy,
      ),
    );
  }

  public deactivate(updatedBy: string): void {
    if (!this._isActive) {
      return;
    }

    this._isActive = false;
    this._updatedBy = updatedBy;
    this._updatedAt = new Date();

    this.addDomainEvent(
      new AIPersonaDeactivatedEvent(this._id, this._name.getValue(), this._companyId, updatedBy),
    );
  }

  public activate(updatedBy: string): void {
    if (this._isActive) {
      return;
    }

    this._isActive = true;
    this._updatedBy = updatedBy;
    this._updatedAt = new Date();

    this.addDomainEvent(
      new AIPersonaActivatedEvent(this._id, this._name.getValue(), this._companyId, updatedBy),
    );
  }

  // Getters
  get id(): string {
    return this._id;
  }
  get name(): AIPersonaName {
    return this._name;
  }
  get keyName(): AIPersonaKeyName {
    return this._keyName;
  }
  get tone(): AIPersonaTone {
    return this._tone;
  }
  get personality(): AIPersonaPersonality {
    return this._personality;
  }
  get objective(): AIPersonaObjective {
    return this._objective;
  }
  get shortDetails(): AIPersonaShortDetails {
    return this._shortDetails;
  }
  get isDefault(): boolean {
    return this._isDefault;
  }
  get companyId(): string | null {
    return this._companyId;
  }
  get isActive(): boolean {
    return this._isActive;
  }
  get createdBy(): string | null {
    return this._createdBy;
  }
  get updatedBy(): string | null {
    return this._updatedBy;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
  get updatedAt(): Date {
    return this._updatedAt;
  }

  set companyId(id: string) {
    this._companyId = id;
  }

  set createdBy(id: string) {
    this._createdBy = id;
  }

  set updatedBy(id: string) {
    this._updatedBy = id;
  }
}
