import { CompanyId } from '@core/value-objects/company-id.vo';
import { CompanyEventId } from '@core/value-objects/company-event-id.vo';

export interface ICompanyEventsCatalogProps {
  title: Record<string, string>; // Multi-language JSON
  description: Record<string, string>; // Multi-language JSON
  iconUrl?: string;
  color?: string;
  isActive: boolean;
  isOnline: boolean;
  isPhysical: boolean;
  isAppointment: boolean;
  eventName: string;
  companyId: CompanyId;
  createdAt: Date;
  updatedAt: Date;
}

export class CompanyEventsCatalog {
  private constructor(
    private readonly _id: CompanyEventId,
    private readonly _props: ICompanyEventsCatalogProps,
  ) {}

  public static create(
    props: Omit<ICompanyEventsCatalogProps, 'createdAt' | 'updatedAt'>,
    id?: CompanyEventId,
  ): CompanyEventsCatalog {
    const now = new Date();
    const eventId = id || CompanyEventId.create();

    // Standardize eventName: lowercase, no double spaces, replace spaces with underscores
    const standardizedEventName = CompanyEventsCatalog.standardizeEventName(props.eventName);

    return new CompanyEventsCatalog(eventId, {
      ...props,
      eventName: standardizedEventName,
      createdAt: now,
      updatedAt: now,
    });
  }

  public static reconstruct(
    id: CompanyEventId,
    props: ICompanyEventsCatalogProps,
  ): CompanyEventsCatalog {
    return new CompanyEventsCatalog(id, props);
  }

  /**
   * Standardize event name: lowercase, remove accents, tabs, line breaks, remove double spaces, replace spaces with underscores
   * Example: " Citas en   el día  " -> "citas_en_el_dia"
   * Example: "Reunión de équipo" -> "reunion_de_equipo"
   * Example: "Event\nwith\ttabs" -> "event_with_tabs"
   */
  public static standardizeEventName(eventName: string): string {
    // Remove accents and diacritics
    const normalized = eventName
      .normalize('NFD') // Decompose accented characters
      .replace(/[\u0300-\u036f]/g, ''); // Remove diacritical marks
    
    return normalized
      .replace(/[\r\n\t]+/g, ' ') // Replace tabs and line breaks with spaces
      .trim() // Remove leading/trailing spaces
      .toLowerCase() // Convert to lowercase
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/\s/g, '_'); // Replace spaces with underscores
  }

  // Getters
  public get id(): CompanyEventId {
    return this._id;
  }

  public get title(): Record<string, string> {
    return this._props.title;
  }

  public get description(): Record<string, string> {
    return this._props.description;
  }

  public get iconUrl(): string | undefined {
    return this._props.iconUrl;
  }

  public get color(): string | undefined {
    return this._props.color;
  }

  public get isActive(): boolean {
    return this._props.isActive;
  }

  public get isOnline(): boolean {
    return this._props.isOnline;
  }

  public get isPhysical(): boolean {
    return this._props.isPhysical;
  }

  public get isAppointment(): boolean {
    return this._props.isAppointment;
  }

  public get eventName(): string {
    return this._props.eventName;
  }

  public get companyId(): CompanyId {
    return this._props.companyId;
  }

  public get createdAt(): Date {
    return this._props.createdAt;
  }

  public get updatedAt(): Date {
    return this._props.updatedAt;
  }

  // Business methods
  public updateTitle(title: Record<string, string>): void {
    this._props.title = title;
    this.touch();
  }

  public updateDescription(description: Record<string, string>): void {
    this._props.description = description;
    this.touch();
  }

  public updateIcon(iconUrl: string): void {
    this._props.iconUrl = iconUrl;
    this.touch();
  }

  public updateColor(color: string): void {
    this._props.color = color;
    this.touch();
  }

  public activate(): void {
    this._props.isActive = true;
    this.touch();
  }

  public deactivate(): void {
    this._props.isActive = false;
    this.touch();
  }

  public toggleOnline(isOnline: boolean): void {
    this._props.isOnline = isOnline;
    this.touch();
  }

  public togglePhysical(isPhysical: boolean): void {
    this._props.isPhysical = isPhysical;
    this.touch();
  }

  public toggleAppointment(isAppointment: boolean): void {
    this._props.isAppointment = isAppointment;
    this.touch();
  }

  private touch(): void {
    this._props.updatedAt = new Date();
  }

  public updateEventName(eventName: string): void {
    this._props.eventName = CompanyEventsCatalog.standardizeEventName(eventName);
    this.touch();
  }

  // Validation
  public isValid(): boolean {
    return (
      this._props.eventName.length > 0 &&
      Object.keys(this._props.title).length > 0 &&
      Object.keys(this._props.description).length > 0 &&
      !!this._props.companyId.getValue()
    );
  }

  // Equality
  public equals(other: CompanyEventsCatalog): boolean {
    return this._id.equals(other._id);
  }

  // Convert to plain object for persistence
  public toPersistence(): Record<string, unknown> {
    return {
      id: this._id.getValue(),
      title: this._props.title,
      description: this._props.description,
      iconUrl: this._props.iconUrl,
      color: this._props.color,
      isActive: this._props.isActive,
      isOnline: this._props.isOnline,
      isPhysical: this._props.isPhysical,
      isAppointment: this._props.isAppointment,
      eventName: this._props.eventName,
      companyId: this._props.companyId.getValue(),
      createdAt: this._props.createdAt,
      updatedAt: this._props.updatedAt,
    };
  }
}
