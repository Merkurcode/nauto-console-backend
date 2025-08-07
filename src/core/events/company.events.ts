import { CompanyId } from '@core/value-objects/company-id.vo';
import { DomainEvent } from './domain-event.base';

export class CompanyCreatedEvent extends DomainEvent {
  constructor(
    public readonly companyId: CompanyId,
    public readonly name: string,
    public readonly description: string,
  ) {
    super();
  }

  getEventName(): string {
    return 'CompanyCreated';
  }
}

export class CompanyUpdatedEvent extends DomainEvent {
  constructor(
    public readonly companyId: CompanyId,
    public readonly name: string,
    public readonly description: string,
  ) {
    super();
  }

  getEventName(): string {
    return 'CompanyUpdated';
  }
}

export class CompanyDeactivatedEvent extends DomainEvent {
  constructor(
    public readonly companyId: CompanyId,
    public readonly name: string,
  ) {
    super();
  }

  getEventName(): string {
    return 'CompanyDeactivated';
  }
}
