import { CompanyId } from '@core/value-objects/company-id.vo';
import { CompanyScheduleId } from '@core/value-objects/company-schedule-id.vo';

export interface ICompanySchedulesProps {
  dayOfWeek: number; // 0=Sunday, 1=Monday, ..., 6=Saturday
  startTime: Date; // Time only (hour and minutes)
  endTime: Date; // Time only (hour and minutes)
  isActive: boolean;
  companyId: CompanyId;
  createdAt: Date;
  updatedAt: Date;
}

export class CompanySchedules {
  private static readonly DAYS = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ];

  private constructor(
    private readonly _id: CompanyScheduleId,
    private readonly _props: ICompanySchedulesProps,
  ) {}

  public static create(
    props: Omit<ICompanySchedulesProps, 'createdAt' | 'updatedAt'>,
    id?: CompanyScheduleId,
  ): CompanySchedules {
    const now = new Date();
    const scheduleId = id || CompanyScheduleId.create();

    // Validate day of week
    if (props.dayOfWeek < 0 || props.dayOfWeek > 6) {
      throw new Error('Day of week must be between 0 (Sunday) and 6 (Saturday)');
    }

    // Validate time range
    if (props.startTime >= props.endTime) {
      throw new Error('Start time must be before end time');
    }

    return new CompanySchedules(scheduleId, {
      ...props,
      createdAt: now,
      updatedAt: now,
    });
  }

  public static reconstruct(
    id: CompanyScheduleId,
    props: ICompanySchedulesProps,
  ): CompanySchedules {
    return new CompanySchedules(id, props);
  }

  // Getters
  public get id(): CompanyScheduleId {
    return this._id;
  }

  public get dayOfWeek(): number {
    return this._props.dayOfWeek;
  }

  public get dayOfWeekName(): string {
    return CompanySchedules.DAYS[this._props.dayOfWeek];
  }

  public get startTime(): Date {
    return this._props.startTime;
  }

  public get endTime(): Date {
    return this._props.endTime;
  }

  public get isActive(): boolean {
    return this._props.isActive;
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
  public updateTimeRange(startTime: Date, endTime: Date): void {
    if (startTime >= endTime) {
      throw new Error('Start time must be before end time');
    }

    this._props.startTime = startTime;
    this._props.endTime = endTime;
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

  private touch(): void {
    this._props.updatedAt = new Date();
  }

  public updateDayOfWeek(dayOfWeek: number): void {
    if (dayOfWeek < 0 || dayOfWeek > 6) {
      throw new Error('Day of week must be between 0 (Sunday) and 6 (Saturday)');
    }
    this._props.dayOfWeek = dayOfWeek;
    this.touch();
  }

  public updateStartTime(startTime: Date): void {
    if (startTime >= this._props.endTime) {
      throw new Error('Start time must be before end time');
    }
    this._props.startTime = startTime;
    this.touch();
  }

  public updateEndTime(endTime: Date): void {
    if (this._props.startTime >= endTime) {
      throw new Error('End time must be after start time');
    }
    this._props.endTime = endTime;
    this.touch();
  }

  public updateIsActive(isActive: boolean): void {
    this._props.isActive = isActive;
    this.touch();
  }

  // Utility methods
  public getDurationInMinutes(): number {
    const diffMs = this._props.endTime.getTime() - this._props.startTime.getTime();

    return Math.floor(diffMs / (1000 * 60));
  }

  public isTimeInRange(time: Date): boolean {
    const timeMs = time.getTime();

    return timeMs >= this._props.startTime.getTime() && timeMs <= this._props.endTime.getTime();
  }

  public overlaps(other: CompanySchedules): boolean {
    if (this._props.dayOfWeek !== other._props.dayOfWeek) {
      return false;
    }

    return (
      (this._props.startTime <= other._props.startTime &&
        this._props.endTime > other._props.startTime) ||
      (this._props.startTime < other._props.endTime &&
        this._props.endTime >= other._props.endTime) ||
      (other._props.startTime <= this._props.startTime &&
        other._props.endTime >= this._props.endTime)
    );
  }

  // Validation
  public isValid(): boolean {
    return (
      this._props.dayOfWeek >= 0 &&
      this._props.dayOfWeek <= 6 &&
      this._props.startTime < this._props.endTime &&
      !!this._props.companyId.getValue()
    );
  }

  // Equality
  public equals(other: CompanySchedules): boolean {
    return this._id.equals(other._id);
  }

  // Convert to plain object for persistence
  public toPersistence(): Record<string, unknown> {
    return {
      id: this._id.getValue(),
      dayOfWeek: this._props.dayOfWeek,
      startTime: this._props.startTime,
      endTime: this._props.endTime,
      isActive: this._props.isActive,
      companyId: this._props.companyId.getValue(),
      createdAt: this._props.createdAt,
      updatedAt: this._props.updatedAt,
    };
  }
}
