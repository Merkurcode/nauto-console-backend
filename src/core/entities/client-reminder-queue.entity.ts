import { AggregateRoot } from '@nestjs/cqrs';
import { CompanyId } from '@core/value-objects/company-id.vo';
import { UserId } from '@core/value-objects/user-id.vo';
import {
  NotificationMedium,
  ReminderNotificationOptOutType,
  ReminderFrequency,
  ReminderQueueStatus,
} from '@prisma/client';
import * as crypto from 'crypto';

export class ClientReminderQueue extends AggregateRoot {
  private _id: string;
  private _queueNumber: bigint;
  private _name: string;
  private _internalNameHash: string;
  private _description?: string;
  private _template: Record<string, unknown>;
  private _targetMedium: NotificationMedium;
  private _notifyType: ReminderNotificationOptOutType;
  private _callActions: string[];
  private _active: boolean;
  private _status: ReminderQueueStatus;
  private _lastTimeChecked?: Date;
  private _companyId: CompanyId;
  private _createdBy: UserId;
  private _updatedBy?: UserId;
  private _createdAt: Date;
  private _updatedAt: Date;

  // Schedule fields
  private _startDate: Date;
  private _endDate: Date;
  private _interval: number;
  private _days: string[];
  private _startHour: string;
  private _endHour: string;
  private _maxCount?: number;
  private _timezone: string;
  private _frequency: ReminderFrequency;
  private _stopUntil?: Date;

  // File tracking fields
  private _sourceFileName?: string;
  private _bulkRequestId?: string;
  private _metadata?: Record<string, unknown>;

  private constructor() {
    super();
  }

  static create(
    name: string,
    description: string | undefined,
    template: Record<string, unknown>,
    targetMedium: NotificationMedium,
    notifyType: ReminderNotificationOptOutType,
    callActions: string[],
    active: boolean,
    companyId: string,
    createdBy: string,
    startDate: Date,
    endDate: Date,
    interval: number,
    days: string[],
    startHour: string,
    endHour: string,
    timezone: string,
    frequency: ReminderFrequency,
    maxCount?: number,
    stopUntil?: Date,
    sourceFileName?: string,
    bulkRequestId?: string,
    metadata?: Record<string, unknown>,
  ): ClientReminderQueue {
    const queue = new ClientReminderQueue();
    queue._id = crypto.randomUUID();
    queue._name = name;
    queue._internalNameHash = queue.generateInternalNameHash(name);
    queue._description = description;
    queue._template = template;
    queue._targetMedium = targetMedium;
    queue._notifyType = notifyType;
    queue._callActions = callActions;
    queue._active = active;
    queue._status = ReminderQueueStatus.STANDBY;
    queue._companyId = CompanyId.fromString(companyId);
    queue._createdBy = UserId.fromString(createdBy);
    queue._startDate = startDate;
    queue._endDate = endDate;
    queue._interval = interval;
    queue._days = days;
    queue._startHour = startHour;
    queue._endHour = endHour;
    queue._maxCount = maxCount;
    queue._timezone = timezone;
    queue._frequency = frequency;
    queue._stopUntil = stopUntil;
    queue._sourceFileName = sourceFileName;
    queue._bulkRequestId = bulkRequestId;
    queue._metadata = metadata;
    queue._createdAt = new Date();
    queue._updatedAt = new Date();

    queue.validateSchedule();

    return queue;
  }

  static reconstitute(
    id: string,
    queueNumber: bigint,
    name: string,
    internalNameHash: string,
    description: string | undefined,
    template: Record<string, unknown>,
    targetMedium: NotificationMedium,
    notifyType: ReminderNotificationOptOutType,
    callActions: string[],
    active: boolean,
    status: ReminderQueueStatus,
    lastTimeChecked: Date | undefined,
    companyId: string,
    createdBy: string,
    updatedBy: string | undefined,
    createdAt: Date,
    updatedAt: Date,
    startDate: Date,
    endDate: Date,
    interval: number,
    days: string[],
    startHour: string,
    endHour: string,
    maxCount: number | undefined,
    timezone: string,
    frequency: ReminderFrequency,
    stopUntil: Date | undefined,
    sourceFileName?: string,
    bulkRequestId?: string,
    metadata?: Record<string, unknown>,
  ): ClientReminderQueue {
    const queue = new ClientReminderQueue();
    queue._id = id;
    queue._queueNumber = queueNumber;
    queue._name = name;
    queue._internalNameHash = internalNameHash;
    queue._description = description;
    queue._template = template;
    queue._targetMedium = targetMedium;
    queue._notifyType = notifyType;
    queue._callActions = callActions;
    queue._active = active;
    queue._status = status;
    queue._lastTimeChecked = lastTimeChecked;
    queue._companyId = CompanyId.fromString(companyId);
    queue._createdBy = UserId.fromString(createdBy);
    queue._updatedBy = updatedBy ? UserId.fromString(updatedBy) : undefined;
    queue._createdAt = createdAt;
    queue._updatedAt = updatedAt;
    queue._startDate = startDate;
    queue._endDate = endDate;
    queue._interval = interval;
    queue._days = days;
    queue._startHour = startHour;
    queue._endHour = endHour;
    queue._maxCount = maxCount;
    queue._timezone = timezone;
    queue._frequency = frequency;
    queue._stopUntil = stopUntil;
    queue._sourceFileName = sourceFileName;
    queue._bulkRequestId = bulkRequestId;
    queue._metadata = metadata;

    return queue;
  }

  private generateInternalNameHash(name: string): string {
    const normalized = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    return crypto.createHash('md5').update(normalized).digest('hex');
  }

  private validateSchedule(): void {
    if (this._startDate >= this._endDate) {
      throw new Error('Start date must be before end date');
    }

    if (this._interval < 1 || this._interval > 1000) {
      throw new Error('Interval must be between 1 and 1000');
    }

    if (this._frequency === ReminderFrequency.WEEKLY && this._days.length > 7) {
      throw new Error('Cannot have more than 7 days for weekly frequency');
    }

    // Validate time format HH:MM:SS
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/;
    if (!timeRegex.test(this._startHour) || !timeRegex.test(this._endHour)) {
      throw new Error('Start hour and end hour must be in HH:MM:SS format');
    }

    if (this._stopUntil && this._stopUntil <= this._startDate) {
      throw new Error('Stop until date must be after start date');
    }
  }

  update(data: {
    name?: string;
    description?: string;
    template?: Record<string, any>;
    targetMedium?: NotificationMedium;
    notifyType?: ReminderNotificationOptOutType;
    callActions?: string[];
    active?: boolean;
    startDate?: Date;
    endDate?: Date;
    interval?: number;
    days?: string[];
    startHour?: string;
    endHour?: string;
    maxCount?: number;
    timezone?: string;
    frequency?: ReminderFrequency;
    stopUntil?: Date;
    updatedBy: string;
  }): void {
    if (this._status === ReminderQueueStatus.COMPLETED) {
      throw new Error('Cannot update a completed queue');
    }

    if (data.name !== undefined) {
      this._name = data.name;
      this._internalNameHash = this.generateInternalNameHash(data.name);
    }
    if (data.description !== undefined) this._description = data.description;
    if (data.template !== undefined) this._template = data.template;
    if (data.targetMedium !== undefined) this._targetMedium = data.targetMedium;
    if (data.notifyType !== undefined) this._notifyType = data.notifyType;
    if (data.callActions !== undefined) this._callActions = data.callActions;
    if (data.startDate !== undefined) this._startDate = data.startDate;
    if (data.endDate !== undefined) this._endDate = data.endDate;
    if (data.interval !== undefined) this._interval = data.interval;
    if (data.days !== undefined) this._days = data.days;
    if (data.startHour !== undefined) this._startHour = data.startHour;
    if (data.endHour !== undefined) this._endHour = data.endHour;
    if (data.maxCount !== undefined) this._maxCount = data.maxCount;
    if (data.timezone !== undefined) this._timezone = data.timezone;
    if (data.frequency !== undefined) this._frequency = data.frequency;
    if (data.stopUntil !== undefined) this._stopUntil = data.stopUntil;

    // Handle active change specially
    if (data.active !== undefined) {
      this.setActive(data.active);
    }

    this._updatedBy = UserId.fromString(data.updatedBy);
    this._updatedAt = new Date();
    this.validateSchedule();
  }

  setActive(active: boolean): void {
    if (this._status === ReminderQueueStatus.COMPLETED && active) {
      throw new Error('Cannot activate a completed queue');
    }

    this._active = active;
    if (!active) {
      this._status = ReminderQueueStatus.STANDBY;
    }
    // Status will be recalculated by SQL functions based on schedule
  }

  setQueueNumber(queueNumber: bigint): void {
    this._queueNumber = queueNumber;
  }

  updateStatus(status: ReminderQueueStatus): void {
    this._status = status;
    this._lastTimeChecked = new Date();
  }

  belongsToCompany(companyId: string): boolean {
    return this._companyId.equals(CompanyId.fromString(companyId));
  }

  // Getters
  get id(): string {
    return this._id;
  }
  get queueNumber(): bigint {
    return this._queueNumber;
  }
  get name(): string {
    return this._name;
  }
  get internalNameHash(): string {
    return this._internalNameHash;
  }
  get description(): string | undefined {
    return this._description;
  }
  get template(): Record<string, unknown> {
    return this._template;
  }
  get targetMedium(): NotificationMedium {
    return this._targetMedium;
  }
  get notifyType(): ReminderNotificationOptOutType {
    return this._notifyType;
  }
  get callActions(): string[] {
    return this._callActions;
  }
  get active(): boolean {
    return this._active;
  }
  get status(): ReminderQueueStatus {
    return this._status;
  }
  get lastTimeChecked(): Date | undefined {
    return this._lastTimeChecked;
  }
  get companyId(): CompanyId {
    return this._companyId;
  }
  get createdBy(): UserId {
    return this._createdBy;
  }
  get updatedBy(): UserId | undefined {
    return this._updatedBy;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
  get updatedAt(): Date {
    return this._updatedAt;
  }
  get startDate(): Date {
    return this._startDate;
  }
  get endDate(): Date {
    return this._endDate;
  }
  get interval(): number {
    return this._interval;
  }
  get days(): string[] {
    return this._days;
  }
  get startHour(): string {
    return this._startHour;
  }
  get endHour(): string {
    return this._endHour;
  }
  get maxCount(): number | undefined {
    return this._maxCount;
  }
  get timezone(): string {
    return this._timezone;
  }
  get frequency(): ReminderFrequency {
    return this._frequency;
  }
  get stopUntil(): Date | undefined {
    return this._stopUntil;
  }
  get sourceFileName(): string | undefined {
    return this._sourceFileName;
  }
  get bulkRequestId(): string | undefined {
    return this._bulkRequestId;
  }
  get metadata(): Record<string, any> | undefined {
    return this._metadata;
  }
}
