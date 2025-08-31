import { UTMName } from '@core/value-objects/marketing-campaign/utm-name.vo';
import { ReferenceName } from '@core/value-objects/marketing-campaign/reference-name.vo';
import { CampaignContext } from '@core/value-objects/marketing-campaign/campaign-context.vo';
import { MetaId } from '@core/value-objects/marketing-campaign/meta-id.vo';
import { CompanyId } from '@core/value-objects/company-id.vo';
import { UserId } from '@core/value-objects/user-id.vo';
import { v4 as uuidv4 } from 'uuid';
import {
  InvalidCampaignDateRangeException,
  CampaignAlreadyEnabledException,
  CampaignAlreadyDisabledException,
} from '@core/exceptions/marketing-campaign.exceptions';
import {
  MarketingCampaignCreatedEvent,
  MarketingCampaignUpdatedEvent,
  MarketingCampaignEnabledEvent,
  MarketingCampaignDisabledEvent,
} from '@core/events/marketing-campaign.events';
import { AggregateRoot } from '@core/events/domain-event.base';

export class MarketingCampaign extends AggregateRoot {
  private readonly _id: string;
  private readonly _startDate: Date;
  private readonly _endDate: Date;
  private readonly _utmName: UTMName;
  private _referenceName: ReferenceName;
  private _context: CampaignContext;
  private _enabled: boolean;
  private _metaId: MetaId;
  private _promotionPictureId: string | null;
  private readonly _companyId: CompanyId;
  private readonly _createdBy: UserId;
  private _updatedBy: UserId;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  private constructor(
    id: string,
    startDate: Date,
    endDate: Date,
    utmName: UTMName,
    referenceName: ReferenceName,
    context: CampaignContext,
    enabled: boolean,
    metaId: MetaId,
    promotionPictureId: string | null,
    companyId: CompanyId,
    createdBy: UserId,
    updatedBy: UserId,
    createdAt: Date,
    updatedAt: Date,
  ) {
    super();
    this._id = id;
    this._startDate = startDate;
    this._endDate = endDate;
    this._utmName = utmName;
    this._referenceName = referenceName;
    this._context = context;
    this._enabled = enabled;
    this._metaId = metaId;
    this._promotionPictureId = promotionPictureId;
    this._companyId = companyId;
    this._createdBy = createdBy;
    this._updatedBy = updatedBy;
    this._createdAt = createdAt;
    this._updatedAt = updatedAt;
  }

  public static create(
    startDate: Date,
    endDate: Date,
    referenceName: ReferenceName,
    context: CampaignContext,
    companyId: CompanyId,
    createdBy: UserId,
    metaId: MetaId | null = null,
    promotionPictureId: string | null = null,
  ): MarketingCampaign {
    if (startDate >= endDate) {
      throw new InvalidCampaignDateRangeException(startDate, endDate);
    }

    const id = MarketingCampaign.generateId();
    const utmName = UTMName.create(referenceName.getValue());
    const now = new Date();

    const campaign = new MarketingCampaign(
      id,
      startDate,
      endDate,
      utmName,
      referenceName,
      context,
      false, // disabled by default
      metaId || MetaId.empty(),
      promotionPictureId,
      companyId,
      createdBy,
      createdBy, // initially created by same user
      now,
      now,
    );

    campaign.addDomainEvent(
      new MarketingCampaignCreatedEvent(
        id,
        companyId.getValue(),
        utmName.getValue(),
        referenceName.getValue(),
        startDate,
        endDate,
        createdBy.getValue(),
      ),
    );

    return campaign;
  }

  public static fromPersistence(
    id: string,
    startDate: Date,
    endDate: Date,
    utmName: string,
    referenceName: string,
    context: string,
    enabled: boolean,
    metaId: string | null,
    promotionPictureId: string | null,
    companyId: string,
    createdBy: string,
    updatedBy: string,
    createdAt: Date,
    updatedAt: Date,
  ): MarketingCampaign {
    return new MarketingCampaign(
      id,
      startDate,
      endDate,
      UTMName.fromString(utmName),
      ReferenceName.fromString(referenceName),
      CampaignContext.fromString(context),
      enabled,
      MetaId.fromString(metaId),
      promotionPictureId,
      CompanyId.fromString(companyId),
      UserId.fromString(createdBy),
      UserId.fromString(updatedBy),
      createdAt,
      updatedAt,
    );
  }

  public update(
    referenceName: ReferenceName,
    context: CampaignContext,
    metaId: MetaId,
    promotionPictureId: string | null,
    updatedBy: UserId,
  ): void {
    this._referenceName = referenceName;
    this._context = context;
    this._metaId = metaId;
    this._promotionPictureId = promotionPictureId;
    this._updatedBy = updatedBy;
    this._updatedAt = new Date();

    this.addDomainEvent(
      new MarketingCampaignUpdatedEvent(
        this._id,
        this._companyId.getValue(),
        referenceName.getValue(),
        context.getValue(),
        updatedBy.getValue(),
      ),
    );
  }

  public enable(updatedBy: UserId): void {
    if (this._enabled) {
      throw new CampaignAlreadyEnabledException(this._id);
    }

    this._enabled = true;
    this._updatedBy = updatedBy;
    this._updatedAt = new Date();

    this.addDomainEvent(
      new MarketingCampaignEnabledEvent(this._id, this._companyId.getValue(), updatedBy.getValue()),
    );
  }

  public disable(updatedBy: UserId): void {
    if (!this._enabled) {
      throw new CampaignAlreadyDisabledException(this._id);
    }

    this._enabled = false;
    this._updatedBy = updatedBy;
    this._updatedAt = new Date();

    this.addDomainEvent(
      new MarketingCampaignDisabledEvent(
        this._id,
        this._companyId.getValue(),
        updatedBy.getValue(),
      ),
    );
  }

  public isActive(): boolean {
    const now = new Date();

    return (
      this._enabled &&
      this._startDate <= now &&
      this._endDate >= now &&
      this._startDate <= this._endDate
    );
  }

  private static generateId(): string {
    return uuidv4();
  }

  // Getters
  get id(): string {
    return this._id;
  }
  get startDate(): Date {
    return this._startDate;
  }
  get endDate(): Date {
    return this._endDate;
  }
  get utmName(): UTMName {
    return this._utmName;
  }
  get referenceName(): ReferenceName {
    return this._referenceName;
  }
  get context(): CampaignContext {
    return this._context;
  }
  get enabled(): boolean {
    return this._enabled;
  }
  get metaId(): MetaId {
    return this._metaId;
  }
  get promotionPictureId(): string | null {
    return this._promotionPictureId;
  }
  get companyId(): CompanyId {
    return this._companyId;
  }
  get createdBy(): UserId {
    return this._createdBy;
  }
  get updatedBy(): UserId {
    return this._updatedBy;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
  get updatedAt(): Date {
    return this._updatedAt;
  }
}
