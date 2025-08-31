import { AggregateRoot } from '@core/events/domain-event.base';
import { StateId } from '@core/value-objects/state-id.vo';
import { CountryId } from '@core/value-objects/country-id.vo';
import { InvalidValueObjectException } from '@core/exceptions/domain-exceptions';
import { StateCreatedEvent, StateUpdatedEvent } from '@core/events/state.events';

export class State extends AggregateRoot {
  private readonly _id: StateId;
  private _name: string;
  private _countryId: CountryId;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  private constructor(id: StateId, name: string, countryId: CountryId, createdAt?: Date) {
    super();
    this._id = id;
    this._name = name;
    this._countryId = countryId;
    this._createdAt = createdAt || new Date();
    this._updatedAt = new Date();
  }

  static create(name: string, countryId: CountryId): State {
    if (!name || !name.trim()) {
      throw new InvalidValueObjectException('State name cannot be empty');
    }

    const stateId = StateId.create();
    const state = new State(stateId, name.trim(), countryId);

    state.addDomainEvent(
      new StateCreatedEvent(stateId, countryId, name.trim(), 'N/A', true, new Date()),
    );

    return state;
  }

  static fromPersistence(data: {
    id: string;
    name: string;
    countryId: string;
    createdAt: Date;
    updatedAt: Date;
  }): State {
    const state = new State(
      StateId.fromString(data.id),
      data.name,
      CountryId.fromString(data.countryId),
      data.createdAt,
    );
    state._updatedAt = data.updatedAt;

    return state;
  }

  // Getters
  get id(): StateId {
    return this._id;
  }

  get name(): string {
    return this._name;
  }

  get countryId(): CountryId {
    return this._countryId;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  // Business methods
  updateName(name: string): void {
    if (!name || !name.trim()) {
      throw new InvalidValueObjectException('State name cannot be empty');
    }

    this._name = name.trim();
    const now = new Date();
    this._updatedAt = now;

    this.addDomainEvent(
      new StateUpdatedEvent(
        this._id,
        this._countryId,
        this._name,
        'N/A',
        { name: name.trim() },
        now,
      ),
    );
  }

  belongsToCountry(countryId: CountryId): boolean {
    return this._countryId.equals(countryId);
  }
}
