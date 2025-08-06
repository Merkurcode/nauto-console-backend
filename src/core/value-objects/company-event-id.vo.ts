import { EntityId } from './entity-id.vo';

export class CompanyEventId extends EntityId {
  private constructor(value: string) {
    super(value);
  }

  static create(): CompanyEventId {
    return new CompanyEventId(super.generateId());
  }

  static fromString(value: string): CompanyEventId {
    return new CompanyEventId(value);
  }
}
