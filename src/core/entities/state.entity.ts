import { AggregateRoot } from '@core/events/domain-event.base';
import { StateId } from '@core/value-objects/state-id.vo';
import { CountryId } from '@core/value-objects/country-id.vo';
import { InvalidValueObjectException } from '@core/exceptions/domain-exceptions';

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

    return new State(StateId.create(), name.trim(), countryId);
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
    this._updatedAt = new Date();
  }

  belongsToCountry(countryId: CountryId): boolean {
    return this._countryId.equals(countryId);
  }
}
