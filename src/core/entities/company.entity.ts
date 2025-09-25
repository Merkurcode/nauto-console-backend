import { CompanyId } from '@core/value-objects/company-id.vo';
import { CompanyName } from '@core/value-objects/company-name.vo';
import { CompanyDescription } from '@core/value-objects/company-description.vo';
import { Address } from '@core/value-objects/address.vo';
import { Host } from '@core/value-objects/host.vo';
import { IndustrySector } from '@core/value-objects/industry-sector.value-object';
import { IndustryOperationChannel } from '@core/value-objects/industry-operation-channel.value-object';
import { AggregateRoot } from '@core/events/domain-event.base';
import {
  CompanyCreatedEvent,
  CompanyUpdatedEvent,
  CompanyDeactivatedEvent,
  CompanyActivatedEvent,
  CompanyAIConfigurationSetEvent,
  CompanyAIConfigurationUpdatedEvent,
  CompanyAIConfigurationRemovedEvent,
  CompanyParentSetEvent,
  CompanyParentRemovedEvent,
  CompanySubsidiaryAddedEvent,
  CompanySubsidiaryRemovedEvent,
  CompanyHostUpdatedEvent,
  CompanyTimezoneUpdatedEvent,
  CompanyCurrencyUpdatedEvent,
  CompanyLanguageUpdatedEvent,
  CompanyLogoUpdatedEvent,
  CompanyWebsiteUpdatedEvent,
  CompanyPrivacyPolicyUpdatedEvent,
  CompanyIndustrySectorUpdatedEvent,
  CompanyIndustryOperationChannelUpdatedEvent,
  CompanyNameUpdatedEvent,
  CompanyDescriptionUpdatedEvent,
  CompanyAddressUpdatedEvent,
} from '@core/events/company.events';
import { InvalidValueObjectException } from '@core/exceptions/domain-exceptions';
import { ICompanyConfigAI } from '@core/interfaces/company-config-ai.interface';
import { User } from './user.entity';

export class Company extends AggregateRoot {
  private readonly _id: CompanyId;
  private _name: CompanyName;
  private _description: CompanyDescription;
  private _address: Address;
  private _host: Host;
  private _isActive: boolean;
  private _industrySector: IndustrySector;
  private _industryOperationChannel: IndustryOperationChannel;
  private _timezone: string;
  private _currency: string;
  private _logoUrl?: string;
  private _websiteUrl?: string;
  private _privacyPolicyUrl?: string;
  private _language: string;
  private _configAI?: ICompanyConfigAI | null;
  private _lastUpdated?: Date | null;
  private _parentCompany?: Company;
  private _subsidiaries: Company[];
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  private constructor(
    id: CompanyId,
    name: CompanyName,
    description: CompanyDescription,
    address: Address,
    host: Host,
    industrySector: IndustrySector,
    industryOperationChannel: IndustryOperationChannel,
    timezone: string,
    currency: string,
    language: string,
    isActive: boolean = true,
    createdAt?: Date,
    parentCompany?: Company,
    logoUrl?: string,
    websiteUrl?: string,
    privacyPolicyUrl?: string,
    configAI?: ICompanyConfigAI | null,
    lastUpdated?: Date | null,
  ) {
    super();
    this._id = id;
    this._name = name;
    this._description = description;
    this._address = address;
    this._host = host;
    this._industrySector = industrySector;
    this._industryOperationChannel = industryOperationChannel;
    this._timezone = timezone;
    this._currency = currency;
    this._language = language;
    this._logoUrl = logoUrl;
    this._websiteUrl = websiteUrl;
    this._privacyPolicyUrl = privacyPolicyUrl;
    this._configAI = configAI;
    this._lastUpdated = lastUpdated;
    this._isActive = isActive;
    this._parentCompany = parentCompany;
    this._subsidiaries = [];
    this._createdAt = createdAt || new Date();
    this._updatedAt = new Date();

    // If parent company is provided, add this company as a subsidiary
    if (parentCompany) {
      parentCompany._subsidiaries.push(this);
    }
  }

  static create(
    name: CompanyName,
    description: CompanyDescription,
    address: Address,
    host: Host,
    timezone?: string,
    currency?: string,
    language?: string,
    industrySector?: IndustrySector,
    industryOperationChannel?: IndustryOperationChannel,
    parentCompany?: Company,
    logoUrl?: string,
    websiteUrl?: string,
    privacyPolicyUrl?: string,
  ): Company {
    const companyId = CompanyId.create();
    const company = new Company(
      companyId,
      name,
      description,
      address,
      host,
      industrySector || IndustrySector.create('OTHER'),
      industryOperationChannel || IndustryOperationChannel.create('MIXED'),
      timezone || 'America/Mexico_City',
      currency || 'MXN',
      language || 'es-MX',
      true,
      undefined,
      parentCompany,
      logoUrl,
      websiteUrl,
      privacyPolicyUrl,
    );

    company.addDomainEvent(
      new CompanyCreatedEvent(companyId, name.getValue(), description.getValue()),
    );

    return company;
  }

  static fromData(data: {
    id: string;
    name: string;
    description: string;
    address: {
      country: string;
      state: string;
      city: string;
      street: string;
      exteriorNumber: string;
      interiorNumber?: string;
      postalCode: string;
      googleMapsUrl?: string;
    };
    host: string;
    timezone?: string;
    currency?: string;
    language?: string;
    logoUrl?: string;
    websiteUrl?: string;
    privacyPolicyUrl?: string;
    industrySector?: string;
    industryOperationChannel?: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    parentCompany?: Company;
    subsidiaries?: Company[];
    configAI?: ICompanyConfigAI | null;
    lastUpdated?: Date | null;
  }): Company {
    const address = new Address(
      data.address.country,
      data.address.state,
      data.address.city,
      data.address.street,
      data.address.exteriorNumber,
      data.address.postalCode,
      data.address.interiorNumber,
      data.address.googleMapsUrl,
    );

    const company = new Company(
      CompanyId.fromString(data.id),
      new CompanyName(data.name),
      new CompanyDescription(data.description),
      address,
      new Host(data.host),
      data.industrySector
        ? IndustrySector.create(data.industrySector)
        : IndustrySector.create('OTHER'),
      data.industryOperationChannel
        ? IndustryOperationChannel.create(data.industryOperationChannel)
        : IndustryOperationChannel.create('MIXED'),
      data.timezone || 'America/Mexico_City',
      data.currency || 'MXN',
      data.language || 'es-MX',
      data.isActive,
      data.createdAt,
      data.parentCompany,
      data.logoUrl,
      data.websiteUrl,
      data.privacyPolicyUrl,
      data.configAI,
      data.lastUpdated,
    );

    // Set subsidiaries if provided
    if (data.subsidiaries) {
      company._subsidiaries = data.subsidiaries;
    }

    company._updatedAt = data.updatedAt;

    return company;
  }

  get id(): CompanyId {
    return this._id;
  }

  get name(): CompanyName {
    return this._name;
  }

  get description(): CompanyDescription {
    return this._description;
  }

  get address(): Address {
    return this._address;
  }

  get host(): Host {
    return this._host;
  }

  get isActive(): boolean {
    return this._isActive;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  get industrySector(): IndustrySector {
    return this._industrySector;
  }

  get industryOperationChannel(): IndustryOperationChannel {
    return this._industryOperationChannel;
  }

  get parentCompany(): Company | undefined {
    return this._parentCompany;
  }

  get subsidiaries(): Company[] {
    return [...this._subsidiaries]; // Return copy to prevent external mutation
  }

  get timezone(): string {
    return this._timezone;
  }

  get currency(): string {
    return this._currency;
  }

  get language(): string {
    return this._language;
  }

  get logoUrl(): string | undefined {
    return this._logoUrl;
  }

  get websiteUrl(): string | undefined {
    return this._websiteUrl;
  }

  get privacyPolicyUrl(): string | undefined {
    return this._privacyPolicyUrl;
  }

  get configAI(): ICompanyConfigAI | null {
    return this._configAI || null;
  }

  get lastUpdated(): Date | null {
    return this._lastUpdated || null;
  }

  updateCompanyInfo(
    name?: CompanyName,
    description?: CompanyDescription,
    address?: Address,
    host?: Host,
    industrySector?: IndustrySector,
    industryOperationChannel?: IndustryOperationChannel,
    timezone?: string,
    currency?: string,
    language?: string,
    logoUrl?: string,
    websiteUrl?: string,
    privacyPolicyUrl?: string,
  ): void {
    if (!this._isActive) {
      throw new InvalidValueObjectException('Cannot update inactive company');
    }

    let hasChanges = false;

    if (name && !this._name.equals(name)) {
      this._name = name;
      hasChanges = true;
    }

    if (description && !this._description.equals(description)) {
      this._description = description;
      hasChanges = true;
    }

    if (address && !this._address.equals(address)) {
      this._address = address;
      hasChanges = true;
    }

    if (host && !this._host.equals(host)) {
      this._host = host;
      hasChanges = true;
    }

    if (industrySector && !this._industrySector.equals(industrySector)) {
      this._industrySector = industrySector;
      hasChanges = true;
    }

    if (
      industryOperationChannel &&
      !this._industryOperationChannel.equals(industryOperationChannel)
    ) {
      this._industryOperationChannel = industryOperationChannel;
      hasChanges = true;
    }

    if (timezone && this._timezone !== timezone) {
      this._timezone = timezone;
      hasChanges = true;
    }

    if (currency && this._currency !== currency) {
      this._currency = currency;
      hasChanges = true;
    }

    if (language && this._language !== language) {
      this._language = language;
      hasChanges = true;
    }

    if (logoUrl !== undefined && this._logoUrl !== logoUrl) {
      this._logoUrl = logoUrl;
      hasChanges = true;
    }

    if (websiteUrl !== undefined && this._websiteUrl !== websiteUrl) {
      this._websiteUrl = websiteUrl;
      hasChanges = true;
    }

    if (privacyPolicyUrl !== undefined && this._privacyPolicyUrl !== privacyPolicyUrl) {
      this._privacyPolicyUrl = privacyPolicyUrl;
      hasChanges = true;
    }

    if (hasChanges) {
      this._updatedAt = new Date();
      this.addDomainEvent(
        new CompanyUpdatedEvent(this._id, this._name.getValue(), this._description.getValue()),
      );
    }
  }

  deactivate(by: User): void {
    if (!this._isActive) {
      return;
    }

    this._isActive = false;
    this._updatedAt = new Date();
    this.addDomainEvent(
      new CompanyDeactivatedEvent(this._id, this._name.getValue(), by.id.getValue()),
    );
  }

  activate(by: User): void {
    if (this._isActive) {
      return;
    }

    this._isActive = true;
    this._updatedAt = new Date();
    this.addDomainEvent(
      new CompanyActivatedEvent(this._id, this._name.getValue(), by.id.getValue()),
    );
  }

  // AI Configuration management methods
  setAIConfiguration(config: ICompanyConfigAI): void {
    if (!this._isActive) {
      throw new InvalidValueObjectException('Cannot update AI configuration for inactive company');
    }

    this._configAI = { ...config };
    this._lastUpdated = new Date();
    this._updatedAt = new Date();
    this.addDomainEvent(new CompanyAIConfigurationSetEvent(this._id, config, this._lastUpdated));
  }

  updateAIConfiguration(config: ICompanyConfigAI): void {
    if (!this._isActive) {
      throw new InvalidValueObjectException('Cannot update AI configuration for inactive company');
    }

    // PUT operation: replace entire configuration
    this._configAI = { ...config };
    this._lastUpdated = new Date();
    this._updatedAt = new Date();
    this.addDomainEvent(
      new CompanyAIConfigurationUpdatedEvent(this._id, config, this._lastUpdated),
    );
  }

  removeAIConfiguration(): void {
    if (!this._isActive) {
      throw new InvalidValueObjectException('Cannot remove AI configuration for inactive company');
    }

    this._configAI = null;
    this._lastUpdated = new Date();
    this._updatedAt = new Date();
    this.addDomainEvent(new CompanyAIConfigurationRemovedEvent(this._id, this._lastUpdated));
  }

  getTenantId(): string {
    return this._id.getValue();
  }

  // Parent company management methods
  setParentCompany(parentCompany: Company): void {
    if (!this._isActive) {
      throw new InvalidValueObjectException('Cannot modify inactive company');
    }

    // Remove from current parent if exists
    if (this._parentCompany) {
      this.removeFromParent();
    }

    // Set new parent
    this._parentCompany = parentCompany;
    parentCompany._subsidiaries.push(this);
    this._updatedAt = new Date();
    this.addDomainEvent(
      new CompanyParentSetEvent(
        this._id,
        parentCompany._id,
        this._name.getValue(),
        parentCompany._name.getValue(),
      ),
    );
  }

  removeFromParent(): void {
    if (!this._isActive) {
      throw new InvalidValueObjectException('Cannot modify inactive company');
    }

    if (this._parentCompany) {
      const previousParent = this._parentCompany;
      const index = this._parentCompany._subsidiaries.findIndex(subsidiary =>
        subsidiary._id.equals(this._id),
      );
      if (index !== -1) {
        this._parentCompany._subsidiaries.splice(index, 1);
      }
      this._parentCompany = undefined;
      this._updatedAt = new Date();
      this.addDomainEvent(
        new CompanyParentRemovedEvent(
          this._id,
          previousParent._id,
          this._name.getValue(),
          previousParent._name.getValue(),
        ),
      );
    }
  }

  addSubsidiary(subsidiary: Company): void {
    if (!this._isActive) {
      throw new InvalidValueObjectException('Cannot modify inactive company');
    }

    // Remove subsidiary from its current parent if exists
    if (subsidiary._parentCompany) {
      subsidiary.removeFromParent();
    }

    // Add as subsidiary
    subsidiary._parentCompany = this;
    this._subsidiaries.push(subsidiary);
    this._updatedAt = new Date();
    this.addDomainEvent(
      new CompanySubsidiaryAddedEvent(
        this._id,
        subsidiary._id,
        this._name.getValue(),
        subsidiary._name.getValue(),
      ),
    );
  }

  removeSubsidiary(subsidiaryId: CompanyId): void {
    if (!this._isActive) {
      throw new InvalidValueObjectException('Cannot modify inactive company');
    }

    const index = this._subsidiaries.findIndex(subsidiary => subsidiary._id.equals(subsidiaryId));

    if (index !== -1) {
      const subsidiary = this._subsidiaries[index];
      subsidiary._parentCompany = undefined;
      this._subsidiaries.splice(index, 1);
      this._updatedAt = new Date();
      this.addDomainEvent(
        new CompanySubsidiaryRemovedEvent(
          this._id,
          subsidiary._id,
          this._name.getValue(),
          subsidiary._name.getValue(),
        ),
      );
    }
  }

  // Hierarchy query methods
  isSubsidiaryOf(companyId: CompanyId): boolean {
    let current = this._parentCompany;
    while (current) {
      if (current._id.equals(companyId)) {
        return true;
      }
      current = current._parentCompany;
    }

    return false;
  }

  isParentOf(companyId: CompanyId): boolean {
    return this._subsidiaries.some(subsidiary => subsidiary._id.equals(companyId));
  }

  getRootCompany(): Company {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let current: Company = this;
    while (current._parentCompany) {
      current = current._parentCompany;
    }

    return current;
  }

  getAllSubsidiaries(): Company[] {
    const result: Company[] = [];

    const addSubsidiariesRecursive = (company: Company) => {
      for (const subsidiary of company._subsidiaries) {
        result.push(subsidiary);
        addSubsidiariesRecursive(subsidiary);
      }
    };

    addSubsidiariesRecursive(this);

    return result;
  }

  getHierarchyLevel(): number {
    let level = 0;
    let current = this._parentCompany;
    while (current) {
      level++;
      current = current._parentCompany;
    }

    return level;
  }

  updateHost(host: Host): void {
    if (!this._isActive) {
      throw new InvalidValueObjectException('Cannot update inactive company');
    }
    const previousHost = this._host.getValue();
    this._host = host;
    this._updatedAt = new Date();
    this.addDomainEvent(
      new CompanyHostUpdatedEvent(this._id, this._name.getValue(), host.getValue(), previousHost),
    );
  }

  updateTimezone(timezone: string): void {
    if (!this._isActive) {
      throw new InvalidValueObjectException('Cannot update inactive company');
    }
    const previousTimezone = this._timezone;
    this._timezone = timezone;
    this._updatedAt = new Date();
    this.addDomainEvent(
      new CompanyTimezoneUpdatedEvent(this._id, this._name.getValue(), timezone, previousTimezone),
    );
  }

  updateCurrency(currency: string): void {
    if (!this._isActive) {
      throw new InvalidValueObjectException('Cannot update inactive company');
    }
    const previousCurrency = this._currency;
    this._currency = currency;
    this._updatedAt = new Date();
    this.addDomainEvent(
      new CompanyCurrencyUpdatedEvent(this._id, this._name.getValue(), currency, previousCurrency),
    );
  }

  updateLanguage(language: string): void {
    if (!this._isActive) {
      throw new InvalidValueObjectException('Cannot update inactive company');
    }
    const previousLanguage = this._language;
    this._language = language;
    this._updatedAt = new Date();
    this.addDomainEvent(
      new CompanyLanguageUpdatedEvent(this._id, this._name.getValue(), language, previousLanguage),
    );
  }

  updateLogoUrl(logoUrl: string): void {
    if (!this._isActive) {
      throw new InvalidValueObjectException('Cannot update inactive company');
    }
    const previousLogoUrl = this._logoUrl;
    this._logoUrl = logoUrl;
    this._updatedAt = new Date();
    this.addDomainEvent(
      new CompanyLogoUpdatedEvent(this._id, this._name.getValue(), logoUrl, previousLogoUrl),
    );
  }

  updateWebsiteUrl(websiteUrl: string): void {
    if (!this._isActive) {
      throw new InvalidValueObjectException('Cannot update inactive company');
    }
    const previousWebsiteUrl = this._websiteUrl;
    this._websiteUrl = websiteUrl;
    this._updatedAt = new Date();
    this.addDomainEvent(
      new CompanyWebsiteUpdatedEvent(
        this._id,
        this._name.getValue(),
        websiteUrl,
        previousWebsiteUrl,
      ),
    );
  }

  updatePrivacyPolicyUrl(privacyPolicyUrl: string): void {
    if (!this._isActive) {
      throw new InvalidValueObjectException('Cannot update inactive company');
    }
    const previousPrivacyPolicyUrl = this._privacyPolicyUrl;
    this._privacyPolicyUrl = privacyPolicyUrl;
    this._updatedAt = new Date();
    this.addDomainEvent(
      new CompanyPrivacyPolicyUpdatedEvent(
        this._id,
        this._name.getValue(),
        privacyPolicyUrl,
        previousPrivacyPolicyUrl,
      ),
    );
  }

  updateIndustrySector(industrySector: IndustrySector): void {
    if (!this._isActive) {
      throw new InvalidValueObjectException('Cannot update inactive company');
    }
    const previousIndustrySector = this._industrySector.value;
    this._industrySector = industrySector;
    this._updatedAt = new Date();
    this.addDomainEvent(
      new CompanyIndustrySectorUpdatedEvent(
        this._id,
        this._name.getValue(),
        industrySector.value,
        previousIndustrySector,
      ),
    );
  }

  updateIndustryOperationChannel(industryOperationChannel: IndustryOperationChannel): void {
    if (!this._isActive) {
      throw new InvalidValueObjectException('Cannot update inactive company');
    }
    const previousIndustryOperationChannel = this._industryOperationChannel.value;
    this._industryOperationChannel = industryOperationChannel;
    this._updatedAt = new Date();
    this.addDomainEvent(
      new CompanyIndustryOperationChannelUpdatedEvent(
        this._id,
        this._name.getValue(),
        industryOperationChannel.value,
        previousIndustryOperationChannel,
      ),
    );
  }

  updateName(name: CompanyName): void {
    if (!this._isActive) {
      throw new InvalidValueObjectException('Cannot update inactive company');
    }
    if (!this._name.equals(name)) {
      const previousName = this._name.getValue();
      this._name = name;
      this._updatedAt = new Date();
      this.addDomainEvent(new CompanyNameUpdatedEvent(this._id, name.getValue(), previousName));
    }
  }

  updateDescription(description: CompanyDescription): void {
    if (!this._isActive) {
      throw new InvalidValueObjectException('Cannot update inactive company');
    }
    if (!this._description.equals(description)) {
      const previousDescription = this._description.getValue();
      this._description = description;
      this._updatedAt = new Date();
      this.addDomainEvent(
        new CompanyDescriptionUpdatedEvent(
          this._id,
          this._name.getValue(),
          description.getValue(),
          previousDescription,
        ),
      );
    }
  }

  updateAddress(address: Address): void {
    if (!this._isActive) {
      throw new InvalidValueObjectException('Cannot update inactive company');
    }
    if (!this._address.equals(address)) {
      const previousAddress = {
        country: this._address.country,
        state: this._address.state,
        city: this._address.city,
        street: this._address.street,
        exteriorNumber: this._address.exteriorNumber,
        interiorNumber: this._address.interiorNumber,
        postalCode: this._address.postalCode,
        fullAddress: this._address.getFullAddress(),
      };
      this._address = address;
      this._updatedAt = new Date();
      this.addDomainEvent(
        new CompanyAddressUpdatedEvent(
          this._id,
          this._name.getValue(),
          {
            country: address.country,
            state: address.state,
            city: address.city,
            street: address.street,
            exteriorNumber: address.exteriorNumber,
            interiorNumber: address.interiorNumber,
            postalCode: address.postalCode,
            fullAddress: address.getFullAddress(),
          },
          previousAddress,
        ),
      );
    }
  }
}
