import { UserActivityType } from '@shared/constants/user-activity-type.enum';
import { UserActivityImpact } from '@shared/constants/user-activity-impact.enum';

export interface IUserActivityLogResponse {
  id: string;
  userId: string;
  activityType: UserActivityType;
  action: string;
  description: string;
  impact: UserActivityImpact;
  version: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

export interface IUserActivityLogPaginatedResponse {
  data: IUserActivityLogResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
