/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable, Inject, ForbiddenException } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';
import { UserActivityLog } from '@core/entities/user-activity-log.entity';
import {
  IUserActivityLogRepository,
  IUserActivityLogFilters,
} from '@core/repositories/user-activity-log.repository.interface';
import { UserId } from '@core/value-objects/user-id.vo';
import { UserActivityType } from '@core/value-objects/user-activity-type.vo';
import { UserActivityImpact } from '@core/value-objects/user-activity-impact.vo';
import { User } from '@core/entities/user.entity';
import { UserActivityLogAccessType } from '@shared/constants/user-activity-log-access-type.enum';
import { UserAuthorizationService } from '@core/services/user-authorization.service';
import { USER_ACTIVITY_LOG_REPOSITORY } from '@shared/constants/tokens';

@Injectable()
export class UserActivityLogService {
  constructor(
    @Inject(USER_ACTIVITY_LOG_REPOSITORY)
    private readonly userActivityLogRepository: IUserActivityLogRepository,
    private readonly eventBus: EventBus,
    private readonly userAuthorizationService: UserAuthorizationService,
  ) {}

  async logActivity(
    userId: UserId,
    activityType: UserActivityType,
    action: string,
    description: string,
    impact: UserActivityImpact,
    ipAddress?: string,
    userAgent?: string,
    metadata?: Record<string, any>,
  ): Promise<UserActivityLog> {
    const userActivityLog = UserActivityLog.create({
      userId,
      activityType,
      action,
      description,
      impact,
      ipAddress,
      userAgent,
      metadata,
    });

    const savedLog = await this.userActivityLogRepository.save(userActivityLog);

    // Publish domain events
    await this.eventBus.publishAll(userActivityLog.getUncommittedEvents());
    userActivityLog.markEventsAsCommitted();

    return savedLog;
  }

  async logAuthentication(
    userId: UserId,
    action: string,
    description: string,
    impact: UserActivityImpact,
    ipAddress?: string,
    userAgent?: string,
    metadata?: Record<string, any>,
  ): Promise<UserActivityLog> {
    const userActivityLog = UserActivityLog.createAuthentication(
      userId,
      action,
      description,
      impact,
      ipAddress,
      userAgent,
      metadata,
    );

    const savedLog = await this.userActivityLogRepository.save(userActivityLog);

    // Publish domain events
    await this.eventBus.publishAll(userActivityLog.getUncommittedEvents());
    userActivityLog.markEventsAsCommitted();

    return savedLog;
  }

  async logProfileManagement(
    userId: UserId,
    action: string,
    description: string,
    impact: UserActivityImpact,
    ipAddress?: string,
    userAgent?: string,
    metadata?: Record<string, any>,
  ): Promise<UserActivityLog> {
    const userActivityLog = UserActivityLog.createProfileManagement(
      userId,
      action,
      description,
      impact,
      ipAddress,
      userAgent,
      metadata,
    );

    const savedLog = await this.userActivityLogRepository.save(userActivityLog);

    // Publish domain events
    await this.eventBus.publishAll(userActivityLog.getUncommittedEvents());
    userActivityLog.markEventsAsCommitted();

    return savedLog;
  }

  async logRoleManagement(
    userId: UserId,
    action: string,
    description: string,
    impact: UserActivityImpact,
    ipAddress?: string,
    userAgent?: string,
    metadata?: Record<string, any>,
  ): Promise<UserActivityLog> {
    const userActivityLog = UserActivityLog.createRoleManagement(
      userId,
      action,
      description,
      impact,
      ipAddress,
      userAgent,
      metadata,
    );

    const savedLog = await this.userActivityLogRepository.save(userActivityLog);

    // Publish domain events
    await this.eventBus.publishAll(userActivityLog.getUncommittedEvents());
    userActivityLog.markEventsAsCommitted();

    return savedLog;
  }

  async logSecuritySettings(
    userId: UserId,
    action: string,
    description: string,
    impact: UserActivityImpact,
    ipAddress?: string,
    userAgent?: string,
    metadata?: Record<string, any>,
  ): Promise<UserActivityLog> {
    const userActivityLog = UserActivityLog.createSecuritySettings(
      userId,
      action,
      description,
      impact,
      ipAddress,
      userAgent,
      metadata,
    );

    const savedLog = await this.userActivityLogRepository.save(userActivityLog);

    // Publish domain events
    await this.eventBus.publishAll(userActivityLog.getUncommittedEvents());
    userActivityLog.markEventsAsCommitted();

    return savedLog;
  }

  async logCompanyAssignment(
    userId: UserId,
    action: string,
    description: string,
    impact: UserActivityImpact,
    ipAddress?: string,
    userAgent?: string,
    metadata?: Record<string, any>,
  ): Promise<UserActivityLog> {
    const userActivityLog = UserActivityLog.createCompanyAssignment(
      userId,
      action,
      description,
      impact,
      ipAddress,
      userAgent,
      metadata,
    );

    const savedLog = await this.userActivityLogRepository.save(userActivityLog);

    // Publish domain events
    await this.eventBus.publishAll(userActivityLog.getUncommittedEvents());
    userActivityLog.markEventsAsCommitted();

    return savedLog;
  }

  async logAccountManagement(
    userId: UserId,
    action: string,
    description: string,
    impact: UserActivityImpact,
    ipAddress?: string,
    userAgent?: string,
    metadata?: Record<string, any>,
  ): Promise<UserActivityLog> {
    const userActivityLog = UserActivityLog.createAccountManagement(
      userId,
      action,
      description,
      impact,
      ipAddress,
      userAgent,
      metadata,
    );

    const savedLog = await this.userActivityLogRepository.save(userActivityLog);

    // Publish domain events
    await this.eventBus.publishAll(userActivityLog.getUncommittedEvents());
    userActivityLog.markEventsAsCommitted();

    return savedLog;
  }

  async getUserActivityLogs(
    userId: UserId,
    filters?: IUserActivityLogFilters,
  ): Promise<UserActivityLog[]> {
    return await this.userActivityLogRepository.findByUserId(userId, filters);
  }

  async getAllActivityLogs(filters?: IUserActivityLogFilters): Promise<UserActivityLog[]> {
    return await this.userActivityLogRepository.findAll(filters);
  }

  async getUserActivityLogsCount(
    userId: UserId,
    filters?: Omit<IUserActivityLogFilters, 'limit' | 'offset'>,
  ): Promise<number> {
    return await this.userActivityLogRepository.countByUserId(userId, filters);
  }

  async getAllActivityLogsCount(
    filters?: Omit<IUserActivityLogFilters, 'limit' | 'offset'>,
  ): Promise<number> {
    return await this.userActivityLogRepository.countAll(filters);
  }

  async getActivityLogById(id: string): Promise<UserActivityLog | null> {
    return await this.userActivityLogRepository.findById(id);
  }

  async deleteUserActivityLogs(userId: UserId): Promise<void> {
    await this.userActivityLogRepository.deleteByUserId(userId);
  }

  /**
   * Validates access permissions and retrieves activity logs based on access type
   * Centralizes all access control logic for UserActivityLog queries
   */
  async validateAndGetActivityLogs(
    currentUserId: string,
    targetUserId: string,
    accessType: UserActivityLogAccessType,
    filters: IUserActivityLogFilters,
  ): Promise<{ logs: UserActivityLog[]; total: number }> {
    // Get current user and validate authorization
    const currentUser = await this.userAuthorizationService.getCurrentUserSafely(currentUserId);

    // Validate access permissions based on access type
    this.validateAccessPermissions(currentUser, targetUserId, accessType);

    // Build repository filters
    const repositoryFilters: IUserActivityLogFilters = {
      activityType: filters.activityType,
      impact: filters.impact,
      action: filters.action,
      fromDate: filters.fromDate,
      toDate: filters.toDate,
      limit: filters.limit,
      offset: filters.offset,
    };

    let userActivityLogs: UserActivityLog[];
    let total: number;

    switch (accessType) {
      case UserActivityLogAccessType.OWN_LOGS:
        const userIdVo = UserId.fromString(currentUserId);
        userActivityLogs = await this.getUserActivityLogs(userIdVo, repositoryFilters);
        const countFilters = { ...repositoryFilters };
        delete countFilters.limit;
        delete countFilters.offset;
        total = await this.getUserActivityLogsCount(userIdVo, countFilters);
        break;

      case UserActivityLogAccessType.SPECIFIC_USER:
        repositoryFilters.userId = targetUserId;
        userActivityLogs = await this.getAllActivityLogs(repositoryFilters);
        const countFiltersSpecific = { ...repositoryFilters };
        delete countFiltersSpecific.limit;
        delete countFiltersSpecific.offset;
        total = await this.getAllActivityLogsCount(countFiltersSpecific);
        break;

      case UserActivityLogAccessType.ALL_USERS:
        userActivityLogs = await this.getAllActivityLogs(repositoryFilters);
        const countFiltersAll = { ...repositoryFilters };
        delete countFiltersAll.limit;
        delete countFiltersAll.offset;
        total = await this.getAllActivityLogsCount(countFiltersAll);
        break;

      default:
        throw new Error(`Invalid access type: ${accessType}`);
    }

    return { logs: userActivityLogs, total };
  }

  /**
   * Validates access permissions for user activity log queries
   * Encapsulates all business rules for access control
   */
  private validateAccessPermissions(
    currentUser: User,
    targetUserId: string,
    accessType: UserActivityLogAccessType,
  ): void {
    const canAccessRootFeatures = this.userAuthorizationService.canAccessRootFeatures(currentUser);

    switch (accessType) {
      case UserActivityLogAccessType.OWN_LOGS:
        // Any authenticated user can access their own logs
        break;

      case UserActivityLogAccessType.SPECIFIC_USER:
        // Only root users can access other users' logs, or if accessing own logs
        const isAccessingOwnLogs = currentUser.id.getValue() === targetUserId;
        if (!canAccessRootFeatures && !isAccessingOwnLogs) {
          throw new ForbiddenException('You can only access your own activity logs');
        }
        break;

      case UserActivityLogAccessType.ALL_USERS:
        // Only root users can access all users' logs
        if (!canAccessRootFeatures) {
          throw new ForbiddenException('Only root users can access all users activity logs');
        }
        break;

      default:
        throw new Error(`Invalid access type: ${accessType}`);
    }
  }
}
