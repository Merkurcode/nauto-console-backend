import { CompanyId } from '@core/value-objects/company-id.vo';
import { DomainEvent } from './domain-event.base';
import { ICompanyConfigAI } from '@core/interfaces/company-config-ai.interface';

export class CompanyCreatedEvent extends DomainEvent {
  constructor(
    public readonly companyId: CompanyId,
    public readonly name: string,
    public readonly description: string,
  ) {
    super();
  }

  getEventName(): string {
    return 'company.created';
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
    return 'company.updated';
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
    return 'company.deactivated';
  }
}

export class CompanyActivatedEvent extends DomainEvent {
  constructor(
    public readonly companyId: CompanyId,
    public readonly name: string,
  ) {
    super();
  }

  getEventName(): string {
    return 'company.activated';
  }
}

export class CompanyAIConfigurationSetEvent extends DomainEvent {
  constructor(
    public readonly companyId: CompanyId,
    public readonly config: ICompanyConfigAI,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'company.ai_configuration.set';
  }
}

export class CompanyAIConfigurationUpdatedEvent extends DomainEvent {
  constructor(
    public readonly companyId: CompanyId,
    public readonly config: ICompanyConfigAI,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'company.ai_configuration.updated';
  }
}

export class CompanyAIConfigurationRemovedEvent extends DomainEvent {
  constructor(
    public readonly companyId: CompanyId,
    public readonly timestamp: Date,
  ) {
    super();
  }

  getEventName(): string {
    return 'company.ai_configuration.removed';
  }
}

export class CompanyParentSetEvent extends DomainEvent {
  constructor(
    public readonly companyId: CompanyId,
    public readonly parentCompanyId: CompanyId,
    public readonly companyName: string,
    public readonly parentCompanyName: string,
  ) {
    super();
  }

  getEventName(): string {
    return 'company.parent.set';
  }
}

export class CompanyParentRemovedEvent extends DomainEvent {
  constructor(
    public readonly companyId: CompanyId,
    public readonly previousParentCompanyId: CompanyId,
    public readonly companyName: string,
    public readonly previousParentCompanyName: string,
  ) {
    super();
  }

  getEventName(): string {
    return 'company.parent.removed';
  }
}

export class CompanySubsidiaryAddedEvent extends DomainEvent {
  constructor(
    public readonly parentCompanyId: CompanyId,
    public readonly subsidiaryCompanyId: CompanyId,
    public readonly parentCompanyName: string,
    public readonly subsidiaryCompanyName: string,
  ) {
    super();
  }

  getEventName(): string {
    return 'company.subsidiary.added';
  }
}

export class CompanySubsidiaryRemovedEvent extends DomainEvent {
  constructor(
    public readonly parentCompanyId: CompanyId,
    public readonly subsidiaryCompanyId: CompanyId,
    public readonly parentCompanyName: string,
    public readonly subsidiaryCompanyName: string,
  ) {
    super();
  }

  getEventName(): string {
    return 'company.subsidiary.removed';
  }
}

export class CompanyHostUpdatedEvent extends DomainEvent {
  constructor(
    public readonly companyId: CompanyId,
    public readonly companyName: string,
    public readonly newHost: string,
    public readonly previousHost?: string,
  ) {
    super();
  }

  getEventName(): string {
    return 'company.host.updated';
  }
}

export class CompanyTimezoneUpdatedEvent extends DomainEvent {
  constructor(
    public readonly companyId: CompanyId,
    public readonly companyName: string,
    public readonly newTimezone: string,
    public readonly previousTimezone: string,
  ) {
    super();
  }

  getEventName(): string {
    return 'company.timezone.updated';
  }
}

export class CompanyCurrencyUpdatedEvent extends DomainEvent {
  constructor(
    public readonly companyId: CompanyId,
    public readonly companyName: string,
    public readonly newCurrency: string,
    public readonly previousCurrency: string,
  ) {
    super();
  }

  getEventName(): string {
    return 'company.currency.updated';
  }
}

export class CompanyLanguageUpdatedEvent extends DomainEvent {
  constructor(
    public readonly companyId: CompanyId,
    public readonly companyName: string,
    public readonly newLanguage: string,
    public readonly previousLanguage: string,
  ) {
    super();
  }

  getEventName(): string {
    return 'company.language.updated';
  }
}

export class CompanyLogoUpdatedEvent extends DomainEvent {
  constructor(
    public readonly companyId: CompanyId,
    public readonly companyName: string,
    public readonly newLogoUrl: string,
    public readonly previousLogoUrl?: string,
  ) {
    super();
  }

  getEventName(): string {
    return 'company.logo.updated';
  }
}

export class CompanyWebsiteUpdatedEvent extends DomainEvent {
  constructor(
    public readonly companyId: CompanyId,
    public readonly companyName: string,
    public readonly newWebsiteUrl: string,
    public readonly previousWebsiteUrl?: string,
  ) {
    super();
  }

  getEventName(): string {
    return 'company.website.updated';
  }
}

export class CompanyPrivacyPolicyUpdatedEvent extends DomainEvent {
  constructor(
    public readonly companyId: CompanyId,
    public readonly companyName: string,
    public readonly newPrivacyPolicyUrl: string,
    public readonly previousPrivacyPolicyUrl?: string,
  ) {
    super();
  }

  getEventName(): string {
    return 'company.privacy_policy.updated';
  }
}

export class CompanyIndustrySectorUpdatedEvent extends DomainEvent {
  constructor(
    public readonly companyId: CompanyId,
    public readonly companyName: string,
    public readonly newIndustrySector: string,
    public readonly previousIndustrySector: string,
  ) {
    super();
  }

  getEventName(): string {
    return 'company.industry_sector.updated';
  }
}

export class CompanyIndustryOperationChannelUpdatedEvent extends DomainEvent {
  constructor(
    public readonly companyId: CompanyId,
    public readonly companyName: string,
    public readonly newIndustryOperationChannel: string,
    public readonly previousIndustryOperationChannel: string,
  ) {
    super();
  }

  getEventName(): string {
    return 'company.industry_operation_channel.updated';
  }
}

export class CompanyNameUpdatedEvent extends DomainEvent {
  constructor(
    public readonly companyId: CompanyId,
    public readonly newName: string,
    public readonly previousName: string,
  ) {
    super();
  }

  getEventName(): string {
    return 'company.name.updated';
  }
}

export class CompanyDescriptionUpdatedEvent extends DomainEvent {
  constructor(
    public readonly companyId: CompanyId,
    public readonly companyName: string,
    public readonly newDescription: string,
    public readonly previousDescription: string,
  ) {
    super();
  }

  getEventName(): string {
    return 'company.description.updated';
  }
}

export class CompanyAddressUpdatedEvent extends DomainEvent {
  constructor(
    public readonly companyId: CompanyId,
    public readonly companyName: string,
    public readonly newAddress: {
      country: string;
      state: string;
      city: string;
      street: string;
      exteriorNumber: string;
      interiorNumber?: string;
      postalCode: string;
      fullAddress: string;
    },
    public readonly previousAddress: {
      country: string;
      state: string;
      city: string;
      street: string;
      exteriorNumber: string;
      interiorNumber?: string;
      postalCode: string;
      fullAddress: string;
    },
  ) {
    super();
  }

  getEventName(): string {
    return 'company.address.updated';
  }
}
