import { CompanyId } from '@core/value-objects/company-id.vo';
import { CompanyName } from '@core/value-objects/company-name.vo';
import { CompanyDescription } from '@core/value-objects/company-description.vo';
import { BusinessSector } from '@core/value-objects/business-sector.vo';
import { BusinessUnit } from '@core/value-objects/business-unit.vo';
import { Address } from '@core/value-objects/address.vo';
import { Host } from '@core/value-objects/host.vo';
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
    isActive: boolean = true,
    createdAt?: Date,
  ) {
    super();
    this._id = id;
    this._name = name;
    this._description = description;
    this._businessSector = businessSector;
    this._businessUnit = businessUnit;
    this._address = address;
    this._host = host;
    this._isActive = isActive;
    this._createdAt = createdAt || new Date();
    this._updatedAt = new Date();
  }

  static create(
    name: CompanyName,
    description: CompanyDescription,
    businessSector: BusinessSector,
    businessUnit: BusinessUnit,
    address: Address,
    host: Host,
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
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
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
      data.isActive,
      data.createdAt,
    );

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

  updateCompanyInfo(
    name?: CompanyName,
    description?: CompanyDescription,
    businessSector?: BusinessSector,
    businessUnit?: BusinessUnit,
    address?: Address,
    host?: Host,
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
}
