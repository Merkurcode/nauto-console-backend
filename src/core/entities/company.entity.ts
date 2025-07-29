import { CompanyId } from '@core/value-objects/company-id.vo';
import { CompanyName } from '@core/value-objects/company-name.vo';
import { CompanyDescription } from '@core/value-objects/company-description.vo';
import { BusinessSector } from '@core/value-objects/business-sector.vo';
import { BusinessUnit } from '@core/value-objects/business-unit.vo';
import { Address } from '@core/value-objects/address.vo';
import { Host } from '@core/value-objects/host.vo';
import { IndustrySector } from '@core/value-objects/industry-sector.value-object';
import { IndustryOperationChannel } from '@core/value-objects/industry-operation-channel.value-object';
import { AggregateRoot } from '@core/events/domain-event.base';
import {
  CompanyCreatedEvent,
  CompanyUpdatedEvent,
  CompanyDeactivatedEvent,
} from '@core/events/company.events';
import { InvalidValueObjectException } from '@core/exceptions/domain-exceptions';

export class Company extends AggregateRoot {
  private readonly _id: CompanyId;
  private _name: CompanyName;
  private _description: CompanyDescription;
  private _businessSector: BusinessSector;
  private _businessUnit: BusinessUnit;
  private _address: Address;
  private _host: Host;
  private _isActive: boolean;
  private _industrySector: IndustrySector;
  private _industryOperationChannel: IndustryOperationChannel;
  private _parentCompany?: Company;
  private _subsidiaries: Company[];
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  private constructor(
    id: CompanyId,
    name: CompanyName,
    description: CompanyDescription,
    businessSector: BusinessSector,
    businessUnit: BusinessUnit,
    address: Address,
    host: Host,
    industrySector: IndustrySector,
    industryOperationChannel: IndustryOperationChannel,
    isActive: boolean = true,
    createdAt?: Date,
    parentCompany?: Company,
  ) {
    super();
    this._id = id;
    this._name = name;
    this._description = description;
    this._businessSector = businessSector;
    this._businessUnit = businessUnit;
    this._address = address;
    this._host = host;
    this._industrySector = industrySector;
    this._industryOperationChannel = industryOperationChannel;
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
    businessSector: BusinessSector,
    businessUnit: BusinessUnit,
    address: Address,
    host: Host,
    industrySector?: IndustrySector,
    industryOperationChannel?: IndustryOperationChannel,
    parentCompany?: Company,
  ): Company {
    const companyId = CompanyId.create();
    const company = new Company(
      companyId,
      name,
      description,
      businessSector,
      businessUnit,
      address,
      host,
      industrySector || IndustrySector.create('OTHER'),
      industryOperationChannel || IndustryOperationChannel.create('MIXED'),
      true,
      undefined,
      parentCompany,
    );

    company.addDomainEvent(
      new CompanyCreatedEvent(
        companyId,
        name.getValue(),
        description.getValue(),
        businessSector.getValue(),
        businessUnit.getValue(),
      ),
    );

    return company;
  }

  static fromData(data: {
    id: string;
    name: string;
    description: string;
    businessSector: string;
    businessUnit: string;
    address: {
      country: string;
      state: string;
      city: string;
      street: string;
      exteriorNumber: string;
      interiorNumber?: string;
      postalCode: string;
    };
    host: string;
    industrySector?: string;
    industryOperationChannel?: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    parentCompany?: Company;
    subsidiaries?: Company[];
  }): Company {
    const address = new Address(
      data.address.country,
      data.address.state,
      data.address.city,
      data.address.street,
      data.address.exteriorNumber,
      data.address.postalCode,
      data.address.interiorNumber,
    );

    const company = new Company(
      CompanyId.fromString(data.id),
      new CompanyName(data.name),
      new CompanyDescription(data.description),
      new BusinessSector(data.businessSector),
      new BusinessUnit(data.businessUnit),
      address,
      new Host(data.host),
      data.industrySector
        ? IndustrySector.create(data.industrySector)
        : IndustrySector.create('OTHER'),
      data.industryOperationChannel
        ? IndustryOperationChannel.create(data.industryOperationChannel)
        : IndustryOperationChannel.create('MIXED'),
      data.isActive,
      data.createdAt,
      data.parentCompany,
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

  get businessSector(): BusinessSector {
    return this._businessSector;
  }

  get businessUnit(): BusinessUnit {
    return this._businessUnit;
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

  updateCompanyInfo(
    name?: CompanyName,
    description?: CompanyDescription,
    businessSector?: BusinessSector,
    businessUnit?: BusinessUnit,
    address?: Address,
    host?: Host,
    industrySector?: IndustrySector,
    industryOperationChannel?: IndustryOperationChannel,
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

    if (businessSector && !this._businessSector.equals(businessSector)) {
      this._businessSector = businessSector;
      hasChanges = true;
    }

    if (businessUnit && !this._businessUnit.equals(businessUnit)) {
      this._businessUnit = businessUnit;
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

    if (hasChanges) {
      this._updatedAt = new Date();
      this.addDomainEvent(
        new CompanyUpdatedEvent(
          this._id,
          this._name.getValue(),
          this._description.getValue(),
          this._businessSector.getValue(),
          this._businessUnit.getValue(),
        ),
      );
    }
  }

  deactivate(): void {
    if (!this._isActive) {
      return;
    }

    this._isActive = false;
    this._updatedAt = new Date();
    this.addDomainEvent(new CompanyDeactivatedEvent(this._id, this._name.getValue()));
  }

  activate(): void {
    if (this._isActive) {
      return;
    }

    this._isActive = true;
    this._updatedAt = new Date();
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
  }

  removeFromParent(): void {
    if (!this._isActive) {
      throw new InvalidValueObjectException('Cannot modify inactive company');
    }

    if (this._parentCompany) {
      const index = this._parentCompany._subsidiaries.findIndex(subsidiary =>
        subsidiary._id.equals(this._id),
      );
      if (index !== -1) {
        this._parentCompany._subsidiaries.splice(index, 1);
      }
      this._parentCompany = undefined;
      this._updatedAt = new Date();
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
  }

  removeSubsidiary(subsidiaryId: CompanyId): void {
    if (!this._isActive) {
      throw new InvalidValueObjectException('Cannot modify inactive company');
    }

    const index = this._subsidiaries.findIndex(subsidiary => subsidiary._id.equals(subsidiaryId));

    if (index !== -1) {
      this._subsidiaries[index]._parentCompany = undefined;
      this._subsidiaries.splice(index, 1);
      this._updatedAt = new Date();
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
}
