import { CompanySchedules } from '@core/entities/company-schedules.entity';
import { CompanyScheduleId } from '@core/value-objects/company-schedule-id.vo';
import { CompanyId } from '@core/value-objects/company-id.vo';

export interface ICompanySchedulesRepository {
  /**
   * Find schedule by ID
   */
  findById(id: CompanyScheduleId): Promise<CompanySchedules | null>;

  /**
   * Find all schedules for a company
   */
  findByCompanyId(companyId: CompanyId): Promise<CompanySchedules[]>;

  /**
   * Find active schedules for a company
   */
  findActiveByCompanyId(companyId: CompanyId): Promise<CompanySchedules[]>;

  /**
   * Find schedule by company and day of week (unique constraint)
   */
  findByCompanyIdAndDayOfWeek(
    companyId: CompanyId,
    dayOfWeek: number,
  ): Promise<CompanySchedules | null>;

  /**
   * Check if schedule exists for a company and day
   */
  existsByCompanyIdAndDayOfWeek(companyId: CompanyId, dayOfWeek: number): Promise<boolean>;

  /**
   * Create new schedule entry
   */
  create(schedule: CompanySchedules): Promise<CompanySchedules>;

  /**
   * Update existing schedule entry
   */
  update(schedule: CompanySchedules): Promise<CompanySchedules>;

  /**
   * Delete schedule entry (hard delete)
   */
  delete(id: CompanyScheduleId): Promise<void>;

  /**
   * Find schedules with filters
   */
  findMany(filters: {
    companyId?: CompanyId;
    isActive?: boolean;
    dayOfWeek?: number;
    timeRange?: {
      startTime: Date;
      endTime: Date;
    };
    limit?: number;
    offset?: number;
  }): Promise<{
    schedules: CompanySchedules[];
    total: number;
  }>;

  /**
   * Get company's weekly schedule (ordered by day of week)
   */
  getWeeklySchedule(companyId: CompanyId): Promise<CompanySchedules[]>;

  /**
   * Check for time conflicts with existing schedules
   */
  hasTimeConflict(
    companyId: CompanyId,
    dayOfWeek: number,
    startTime: Date,
    endTime: Date,
    excludeId?: CompanyScheduleId,
  ): Promise<boolean>;

  /**
   * Bulk update active status for company schedules
   */
  bulkUpdateActiveStatus(
    companyId: CompanyId,
    scheduleIds: CompanyScheduleId[],
    isActive: boolean,
  ): Promise<void>;

  /**
   * Delete all schedules for a company
   */
  deleteByCompanyId(companyId: CompanyId): Promise<void>;
}
