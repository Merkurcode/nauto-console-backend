import { AggregateRoot } from '@core/events/domain-event.base';
import { UserId } from '@core/value-objects/user-id.vo';
import { RoleId } from '@core/value-objects/role-id.vo';
import { UserRoleCreatedEvent, UserRoleDeletedEvent } from '@core/events/user-role.events';

export interface IUserRoleProps {
  userId: UserId;
  roleId: RoleId;
  createdAt: Date;
}

export class UserRole extends AggregateRoot {
  private constructor(private readonly _props: IUserRoleProps) {
    super();
  }

  public static create(props: Omit<IUserRoleProps, 'createdAt'>): UserRole {
    const now = new Date();
    const userRole = new UserRole({
      ...props,
      createdAt: now,
    });

    userRole.addDomainEvent(
      new UserRoleCreatedEvent(
        UserId.create(),
        props.userId,
        props.roleId,
        'User',
        'Role',
        props.userId,
        now,
      ),
    );

    return userRole;
  }

  public static reconstruct(props: IUserRoleProps): UserRole {
    return new UserRole(props);
  }

  // Getters
  public get userId(): UserId {
    return this._props.userId;
  }

  public get roleId(): RoleId {
    return this._props.roleId;
  }

  public get createdAt(): Date {
    return this._props.createdAt;
  }

  // Business methods
  public isForUser(userId: UserId): boolean {
    return this._props.userId.equals(userId);
  }

  public isForRole(roleId: RoleId): boolean {
    return this._props.roleId.equals(roleId);
  }

  public matches(userId: UserId, roleId: RoleId): boolean {
    return this.isForUser(userId) && this.isForRole(roleId);
  }

  public markForDeletion(): void {
    this.addDomainEvent(
      new UserRoleDeletedEvent(
        UserId.create(),
        this._props.userId,
        this._props.roleId,
        'User',
        'Role',
        this._props.userId,
        new Date(),
      ),
    );
  }

  // Validation
  public isValid(): boolean {
    return !!this._props.userId && !!this._props.roleId;
  }

  // Composite key for identification
  public getCompositeKey(): string {
    return `${this._props.userId.getValue()}_${this._props.roleId.getValue()}`;
  }
}
