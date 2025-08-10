import { AggregateRoot } from '@core/events/domain-event.base';
import { UserId } from '@core/value-objects/user-id.vo';
import { RoleId } from '@core/value-objects/role-id.vo';

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

    return new UserRole({
      ...props,
      createdAt: now,
    });
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

  // Validation
  public isValid(): boolean {
    return !!this._props.userId && !!this._props.roleId;
  }

  // Composite key for identification
  public getCompositeKey(): string {
    return `${this._props.userId.getValue()}_${this._props.roleId.getValue()}`;
  }
}
