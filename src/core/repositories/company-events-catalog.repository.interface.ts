import { CompanyEventsCatalog } from '@core/entities/company-events-catalog.entity';
import { CompanyEventId } from '@core/value-objects/company-event-id.vo';
import { CompanyId } from '@core/value-objects/company-id.vo';

export interface ICompanyEventsCatalogRepository {
  /**
   * Find event catalog by ID
   */
  findById(id: CompanyEventId): Promise<CompanyEventsCatalog | null>;

  /**
   * Find all events for a company
   */
  findByCompanyId(companyId: CompanyId): Promise<CompanyEventsCatalog[]>;

  /**
   * Find active events for a company
   */
  findActiveByCompanyId(companyId: CompanyId): Promise<CompanyEventsCatalog[]>;

  /**
   * Find event by company and event name (unique constraint)
   */
  findByCompanyIdAndEventName(
    companyId: CompanyId,
    eventName: string,
  ): Promise<CompanyEventsCatalog | null>;

  /**
   * Check if event name exists for a company
   */
  existsByCompanyIdAndEventName(companyId: CompanyId, eventName: string): Promise<boolean>;

  /**
   * Create new event catalog entry
   */
  create(eventCatalog: CompanyEventsCatalog): Promise<CompanyEventsCatalog>;

  /**
   * Update existing event catalog entry
   */
  update(eventCatalog: CompanyEventsCatalog): Promise<CompanyEventsCatalog>;

  /**
   * Delete event catalog entry (hard delete)
   */
  delete(id: CompanyEventId): Promise<void>;

  /**
   * Find events with filters
   */
  findMany(filters: {
    companyId?: CompanyId;
    isActive?: boolean;
    isOnline?: boolean;
    isPhysical?: boolean;
    isAppointment?: boolean;
    eventNamePattern?: string;
    limit?: number;
    offset?: number;
  }): Promise<{
    events: CompanyEventsCatalog[];
    total: number;
  }>;

  /**
   * Bulk update active status for company events
   */
  bulkUpdateActiveStatus(
    companyId: CompanyId,
    eventIds: CompanyEventId[],
    isActive: boolean,
  ): Promise<void>;
}
