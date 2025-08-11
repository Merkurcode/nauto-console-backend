import { UserActivityLog } from '@core/entities/user-activity-log.entity';
import { UserId } from '@core/value-objects/user-id.vo';
import { UserActivityType } from '@shared/constants/user-activity-type.enum';
import { UserActivityImpact } from '@shared/constants/user-activity-impact.enum';

export interface IUserActivityLogFilters {
  userId?: string;
  activityType?: UserActivityType;
  impact?: UserActivityImpact;
  action?: string;
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
  offset?: number;
}

export interface IUserActivityLogRepository {
  save(userActivityLog: UserActivityLog): Promise<UserActivityLog>;
  findById(id: string): Promise<UserActivityLog | null>;
  findByUserId(userId: UserId, filters?: IUserActivityLogFilters): Promise<UserActivityLog[]>;
  findAll(filters?: IUserActivityLogFilters): Promise<UserActivityLog[]>;
  countByUserId(
    userId: UserId,
    filters?: Omit<IUserActivityLogFilters, 'limit' | 'offset'>,
  ): Promise<number>;
  countAll(filters?: Omit<IUserActivityLogFilters, 'limit' | 'offset'>): Promise<number>;
  deleteByUserId(userId: UserId): Promise<void>;
}
