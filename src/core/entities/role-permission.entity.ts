import { AggregateRoot } from '@core/events/domain-event.base';
import { RoleId } from '@core/value-objects/role-id.vo';
import { PermissionId } from '@core/value-objects/permission-id.vo';
import {
  RolePermissionCreatedEvent,
  RolePermissionDeletedEvent,
} from '@core/events/role-permission.events';

export interface IRolePermissionProps {
  roleId: RoleId;
  permissionId: PermissionId;
  createdAt: Date;
}

export class RolePermission extends AggregateRoot {
  private constructor(private readonly _props: IRolePermissionProps) {
    super();
  }

  public static create(props: Omit<IRolePermissionProps, 'createdAt'>): RolePermission {
    const now = new Date();
    const rolePermission = new RolePermission({
      ...props,
      createdAt: now,
    });

    rolePermission.addDomainEvent(
      new RolePermissionCreatedEvent(
        RoleId.create(),
        props.roleId,
        props.permissionId,
        'Role',
        'Permission',
        now,
      ),
    );

    return rolePermission;
  }

  public static reconstruct(props: IRolePermissionProps): RolePermission {
    return new RolePermission(props);
  }

  // Getters
  public get roleId(): RoleId {
    return this._props.roleId;
  }

  public get permissionId(): PermissionId {
    return this._props.permissionId;
  }

  public get createdAt(): Date {
    return this._props.createdAt;
  }

  // Business methods
  public isForRole(roleId: RoleId): boolean {
    return this._props.roleId.equals(roleId);
  }

  public isForPermission(permissionId: PermissionId): boolean {
    return this._props.permissionId.equals(permissionId);
  }

  public matches(roleId: RoleId, permissionId: PermissionId): boolean {
    return this.isForRole(roleId) && this.isForPermission(permissionId);
  }

  public markForDeletion(): void {
    this.addDomainEvent(
      new RolePermissionDeletedEvent(
        RoleId.create(),
        this._props.roleId,
        this._props.permissionId,
        'Role',
        'Permission',
        new Date(),
      ),
    );
  }

  // Validation
  public isValid(): boolean {
    return !!this._props.roleId && !!this._props.permissionId;
  }

  // Composite key for identification
  public getCompositeKey(): string {
    return `${this._props.roleId.getValue()}_${this._props.permissionId.getValue()}`;
  }
}
