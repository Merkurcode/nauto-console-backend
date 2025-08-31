import { AggregateRoot } from '@core/events/domain-event.base';
import { UserId } from '@core/value-objects/user-id.vo';
import { UserActivityType } from '@core/value-objects/user-activity-type.vo';
import { UserActivityImpact } from '@core/value-objects/user-activity-impact.vo';
import { v4 as uuidv4 } from 'uuid';
import {
  UserActivityLogCreatedEvent,
  LowImpactActivityLoggedEvent,
  MediumImpactActivityLoggedEvent,
  HighImpactActivityLoggedEvent,
  CriticalImpactActivityLoggedEvent,
  AuthenticationActivityCreatedEvent,
  ProfileManagementActivityCreatedEvent,
  RoleManagementActivityCreatedEvent,
  SecuritySettingsActivityCreatedEvent,
  CompanyAssignmentActivityCreatedEvent,
  AccountManagementActivityCreatedEvent,
} from '@core/events/user-activity-log.events';
import { UserActivityImpact as UserActivityImpactEnum } from '@shared/constants/user-activity-impact.enum';

export interface IUserActivityLogProps {
  userId: UserId;
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

export class UserActivityLog extends AggregateRoot {
  private readonly _id: string;
  private readonly _userId: UserId;
  private readonly _activityType: UserActivityType;
  private readonly _action: string;
  private readonly _description: string;
  private readonly _impact: UserActivityImpact;
  private readonly _version: string;
  private readonly _ipAddress?: string;
  private readonly _userAgent?: string;
  private readonly _metadata?: Record<string, unknown>;
  private readonly _timestamp: Date;

  private constructor(
    id: string,
    userId: UserId,
    activityType: UserActivityType,
    action: string,
    description: string,
    impact: UserActivityImpact,
    version: string,
    timestamp: Date,
    ipAddress?: string,
    userAgent?: string,
    metadata?: Record<string, unknown>,
  ) {
    super();
    this._id = id;
    this._userId = userId;
    this._activityType = activityType;
    this._action = action;
    this._description = description;
    this._impact = impact;
    this._version = version;
    this._timestamp = timestamp;
    this._ipAddress = ipAddress;
    this._userAgent = userAgent;
    this._metadata = metadata;
  }

  private static generateId(): string {
    return uuidv4();
  }

  // Factory method to reconstruct from persistence (without events)
  public static fromPersistence(props: IUserActivityLogProps, id: string): UserActivityLog {
    return new UserActivityLog(
      id,
      props.userId,
      props.activityType,
      props.action,
      props.description,
      props.impact,
      props.version,
      props.timestamp,
      props.ipAddress,
      props.userAgent,
      props.metadata,
    );
  }

  public static create(
    props: Omit<IUserActivityLogProps, 'timestamp' | 'version'> & {
      timestamp?: Date;
      version?: string;
    },
  ): UserActivityLog {
    const id = this.generateId();
    const timestamp = props.timestamp || new Date();
    const version = props.version || process.env.APP_VERSION;

    const instance = new UserActivityLog(
      id,
      props.userId,
      props.activityType,
      props.action,
      props.description,
      props.impact,
      version,
      timestamp,
      props.ipAddress,
      props.userAgent,
      props.metadata,
    );

    // Add general creation event
    instance.addDomainEvent(
      new UserActivityLogCreatedEvent(
        instance._id,
        props.userId,
        props.activityType.getValue(),
        props.action,
        props.description,
        props.impact.getValue(),
        version,
        props.ipAddress,
        props.userAgent,
        props.metadata,
      ),
    );

    // Add specific impact event based on impact level
    const eventData = {
      userActivityLogId: instance._id,
      userId: props.userId,
      activityType: props.activityType.getValue(),
      action: props.action,
      description: props.description,
      version: version,
      ipAddress: props.ipAddress,
      userAgent: props.userAgent,
      metadata: props.metadata,
    };

    switch (props.impact.getValue()) {
      case UserActivityImpactEnum.LOW:
        instance.addDomainEvent(
          new LowImpactActivityLoggedEvent(
            eventData.userActivityLogId,
            eventData.userId,
            eventData.activityType,
            eventData.action,
            eventData.description,
            eventData.version,
            eventData.ipAddress,
            eventData.userAgent,
            eventData.metadata,
          ),
        );
        break;
      case UserActivityImpactEnum.MEDIUM:
        instance.addDomainEvent(
          new MediumImpactActivityLoggedEvent(
            eventData.userActivityLogId,
            eventData.userId,
            eventData.activityType,
            eventData.action,
            eventData.description,
            eventData.version,
            eventData.ipAddress,
            eventData.userAgent,
            eventData.metadata,
          ),
        );
        break;
      case UserActivityImpactEnum.HIGH:
        instance.addDomainEvent(
          new HighImpactActivityLoggedEvent(
            eventData.userActivityLogId,
            eventData.userId,
            eventData.activityType,
            eventData.action,
            eventData.description,
            eventData.version,
            eventData.ipAddress,
            eventData.userAgent,
            eventData.metadata,
          ),
        );
        break;
      case UserActivityImpactEnum.CRITICAL:
        instance.addDomainEvent(
          new CriticalImpactActivityLoggedEvent(
            eventData.userActivityLogId,
            eventData.userId,
            eventData.activityType,
            eventData.action,
            eventData.description,
            eventData.version,
            eventData.ipAddress,
            eventData.userAgent,
            eventData.metadata,
          ),
        );
        break;
    }

    return instance;
  }

  // Getters
  get id(): string {
    return this._id;
  }

  get userId(): UserId {
    return this._userId;
  }

  get activityType(): UserActivityType {
    return this._activityType;
  }

  get action(): string {
    return this._action;
  }

  get description(): string {
    return this._description;
  }

  get impact(): UserActivityImpact {
    return this._impact;
  }

  get ipAddress(): string | undefined {
    return this._ipAddress;
  }

  get userAgent(): string | undefined {
    return this._userAgent;
  }

  get metadata(): Record<string, unknown> | undefined {
    return this._metadata;
  }

  get timestamp(): Date {
    return this._timestamp;
  }

  get version(): string {
    return this._version;
  }

  public static createAuthentication(
    userId: UserId,
    action: string,
    description: string,
    impact: UserActivityImpact,
    ipAddress?: string,
    userAgent?: string,
    metadata?: Record<string, unknown>,
  ): UserActivityLog {
    const instance = this.create({
      userId,
      activityType: UserActivityType.AUTHENTICATION(),
      action,
      description,
      impact,
      ipAddress,
      userAgent,
      metadata,
    });

    // Add specific authentication event
    instance.addDomainEvent(
      new AuthenticationActivityCreatedEvent(
        instance._id,
        userId,
        action,
        description,
        impact.getValue(),
        instance._version,
        ipAddress,
        userAgent,
        metadata,
      ),
    );

    return instance;
  }

  public static createProfileManagement(
    userId: UserId,
    action: string,
    description: string,
    impact: UserActivityImpact,
    ipAddress?: string,
    userAgent?: string,
    metadata?: Record<string, unknown>,
  ): UserActivityLog {
    const instance = this.create({
      userId,
      activityType: UserActivityType.PROFILE_MANAGEMENT(),
      action,
      description,
      impact,
      ipAddress,
      userAgent,
      metadata,
    });

    instance.addDomainEvent(
      new ProfileManagementActivityCreatedEvent(
        instance._id,
        userId,
        action,
        description,
        impact.getValue(),
        instance._version,
        ipAddress,
        userAgent,
        metadata,
      ),
    );

    return instance;
  }

  public static createRoleManagement(
    userId: UserId,
    action: string,
    description: string,
    impact: UserActivityImpact,
    ipAddress?: string,
    userAgent?: string,
    metadata?: Record<string, unknown>,
  ): UserActivityLog {
    const instance = this.create({
      userId,
      activityType: UserActivityType.ROLE_MANAGEMENT(),
      action,
      description,
      impact,
      ipAddress,
      userAgent,
      metadata,
    });

    instance.addDomainEvent(
      new RoleManagementActivityCreatedEvent(
        instance._id,
        userId,
        action,
        description,
        impact.getValue(),
        instance._version,
        ipAddress,
        userAgent,
        metadata,
      ),
    );

    return instance;
  }

  public static createSecuritySettings(
    userId: UserId,
    action: string,
    description: string,
    impact: UserActivityImpact,
    ipAddress?: string,
    userAgent?: string,
    metadata?: Record<string, unknown>,
  ): UserActivityLog {
    const instance = this.create({
      userId,
      activityType: UserActivityType.SECURITY_SETTINGS(),
      action,
      description,
      impact,
      ipAddress,
      userAgent,
      metadata,
    });

    instance.addDomainEvent(
      new SecuritySettingsActivityCreatedEvent(
        instance._id,
        userId,
        action,
        description,
        impact.getValue(),
        instance._version,
        ipAddress,
        userAgent,
        metadata,
      ),
    );

    return instance;
  }

  public static createCompanyAssignment(
    userId: UserId,
    action: string,
    description: string,
    impact: UserActivityImpact,
    ipAddress?: string,
    userAgent?: string,
    metadata?: Record<string, unknown>,
  ): UserActivityLog {
    const instance = this.create({
      userId,
      activityType: UserActivityType.COMPANY_ASSIGNMENT(),
      action,
      description,
      impact,
      ipAddress,
      userAgent,
      metadata,
    });

    instance.addDomainEvent(
      new CompanyAssignmentActivityCreatedEvent(
        instance._id,
        userId,
        action,
        description,
        impact.getValue(),
        instance._version,
        ipAddress,
        userAgent,
        metadata,
      ),
    );

    return instance;
  }

  public static createAccountManagement(
    userId: UserId,
    action: string,
    description: string,
    impact: UserActivityImpact,
    ipAddress?: string,
    userAgent?: string,
    metadata?: Record<string, unknown>,
  ): UserActivityLog {
    const instance = this.create({
      userId,
      activityType: UserActivityType.ACCOUNT_MANAGEMENT(),
      action,
      description,
      impact,
      ipAddress,
      userAgent,
      metadata,
    });

    instance.addDomainEvent(
      new AccountManagementActivityCreatedEvent(
        instance._id,
        userId,
        action,
        description,
        impact.getValue(),
        instance._version,
        ipAddress,
        userAgent,
        metadata,
      ),
    );

    return instance;
  }
}
