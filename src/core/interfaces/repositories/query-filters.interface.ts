import { UserActivityType, UserActivityImpact, Prisma } from '@prisma/client';

/**
 * Interface for audit log where clause construction
 * Provides type safety for dynamic query building
 */
export interface IAuditLogWhereClause {
  level?: Prisma.StringFilter<'AuditLog'> | string;
  type?: Prisma.StringFilter<'AuditLog'> | string;
  userId?: string | null;
  context?: Prisma.StringFilter<'AuditLog'> | string;
  timestamp?: ITimestampFilter;
  metadata?: Prisma.JsonFilter<'AuditLog'>;
  OR?: Array<{
    message?: Prisma.StringFilter<'AuditLog'>;
    context?: Prisma.StringFilter<'AuditLog'>;
    type?: Prisma.StringFilter<'AuditLog'>;
    action?: Prisma.StringFilter<'AuditLog'>;
  }>;
}

/**
 * Interface for timestamp filtering in queries
 */
export interface ITimestampFilter {
  gte?: Date;
  lte?: Date;
  lt?: Date;
  gt?: Date;
}

/**
 * Interface for user activity log where clause construction
 */
export interface IUserActivityLogWhereClause {
  userId?: string;
  action?: string | Prisma.StringFilter<'UserActivityLog'>;
  activityType?: UserActivityType;
  impact?: UserActivityImpact;
  timestamp?: ITimestampFilter;
  metadata?: Prisma.JsonNullableFilter<'UserActivityLog'>;
}

/**
 * Interface for repository error handling
 */
export interface IRepositoryError {
  message: string;
  code?: string;
  operation: string;
  timestamp: Date;
  context?: string;
}
