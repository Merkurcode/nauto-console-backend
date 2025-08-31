import { DomainEvent } from './domain-event.base';

export class MarketingCampaignCreatedEvent extends DomainEvent {
  constructor(
    public readonly campaignId: string,
    public readonly companyId: string,
    public readonly utmName: string,
    public readonly referenceName: string,
    public readonly startDate: Date,
    public readonly endDate: Date,
    public readonly createdBy: string,
  ) {
    super();
  }

  getEventName(): string {
    return 'marketing_campaign.created';
  }
}

export class MarketingCampaignUpdatedEvent extends DomainEvent {
  constructor(
    public readonly campaignId: string,
    public readonly companyId: string,
    public readonly referenceName: string,
    public readonly context: string,
    public readonly updatedBy: string,
  ) {
    super();
  }

  getEventName(): string {
    return 'marketing_campaign.updated';
  }
}

export class MarketingCampaignEnabledEvent extends DomainEvent {
  constructor(
    public readonly campaignId: string,
    public readonly companyId: string,
    public readonly enabledBy: string,
  ) {
    super();
  }

  getEventName(): string {
    return 'marketing_campaign.enabled';
  }
}

export class MarketingCampaignDisabledEvent extends DomainEvent {
  constructor(
    public readonly campaignId: string,
    public readonly companyId: string,
    public readonly disabledBy: string,
  ) {
    super();
  }

  getEventName(): string {
    return 'marketing_campaign.disabled';
  }
}

export class MarketingCampaignDeletedEvent extends DomainEvent {
  constructor(
    public readonly campaignId: string,
    public readonly companyId: string,
    public readonly deletedBy: string,
  ) {
    super();
  }

  getEventName(): string {
    return 'marketing_campaign.deleted';
  }
}
