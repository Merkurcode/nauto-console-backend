import { EntityId } from './entity-id.vo';

export class CompanyScheduleId extends EntityId {
  private constructor(value: string) {
    super(value);
  }

  static create(): CompanyScheduleId {
    return new CompanyScheduleId(super.generateId());
  }

  static fromString(value: string): CompanyScheduleId {
    return new CompanyScheduleId(value);
  }
}
