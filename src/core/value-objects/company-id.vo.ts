import { EntityId } from './entity-id.vo';

export class CompanyId extends EntityId {
  private constructor(value: string) {
    super(value);
  }

  static create(): CompanyId {
    return new CompanyId(super.generateId());
  }

  static fromString(value: string): CompanyId {
    return new CompanyId(value);
  }
}
