import {
  NotificationMedium,
  ReminderNotificationOptOutType,
  ReminderFrequency,
  ReminderQueueStatus,
} from '@prisma/client';

export interface IClientReminderQueueResponse {
  id: string;
  queueNumber: string; // BigInt as string for JSON serialization
  name: string;
  internalNameHash: string;
  description?: string;
  template: Record<string, any>;
  targetMedium: NotificationMedium;
  notifyType: ReminderNotificationOptOutType;
  callActions: string[];
  active: boolean;
  status: ReminderQueueStatus;
  lastTimeChecked?: Date;
  companyId: string;
  createdBy: string;
  updatedBy?: string;
  createdAt: Date;
  updatedAt: Date;

  // Schedule fields
  startDate: Date;
  endDate: Date;
  interval: number;
  days: string[];
  startHour: string;
  endHour: string;
  maxCount?: number;
  timezone: string;
  frequency: ReminderFrequency;
  stopUntil?: Date;

  // File tracking fields
  sourceFileName?: string;
  bulkRequestId?: string;
  metadata?: Record<string, any>;
}
