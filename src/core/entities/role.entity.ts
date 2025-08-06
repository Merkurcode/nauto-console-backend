import { Permission } from './permission.entity';
import { RoleId } from '@core/value-objects/role-id.vo';
import { PermissionId } from '@core/value-objects/permission-id.vo';
import { AggregateRoot } from '@core/events/domain-event.base';
import {
  CannotDeleteDefaultRoleException,
  PermissionAlreadyAssignedException,
  InvalidValueObjectException,
} from '@core/exceptions/domain-exceptions';
import { CanAssignPermissionToRoleSpecification } from '@core/specifications/role.specifications';
import { PermissionsCollection } from '@core/value-objects/collections/permissions.collection';
import { RolesEnum } from '@shared/constants/enums';

export class Role extends AggregateRoot {
  private readonly _id: RoleId;
  private _name: string;
  private _description: string;
  private _hierarchyLevel: number;
  private _permissions: Permission[];
  private _isDefault: boolean;
  private _isDefaultAppRole: boolean;
  private readonly _createdAt: Date;
  private _updatedAt: Date;

  private constructor(
    id: RoleId,
    name: string,
    description: string,
    hierarchyLevel: number = 5,
    isDefault: boolean = false,
    isDefaultAppRole: boolean = false,
    createdAt?: Date,
  ) {
    super();
    this.validateName(name);
    this.validateDescription(description);
    this.validateHierarchyLevel(hierarchyLevel);

    this._id = id;
    this._name = name;
    this._description = description;
    this._hierarchyLevel = hierarchyLevel;
    this._permissions = [];
    this._isDefault = isDefault;
    this._isDefaultAppRole = isDefaultAppRole;
    this._createdAt = createdAt || new Date();
    this._updatedAt = new Date();
  }

  // Factory method for creating new roles
  static create(
    name: string,
    description: string,
    hierarchyLevel: number = 5,
    isDefault: boolean = false,
    isDefaultAppRole: boolean = false,
  ): Role {
    return new Role(
      RoleId.create(),
      name,
      description,
      hierarchyLevel,
      isDefault,
      isDefaultAppRole,
    );
  }

  // Factory method for reconstituting from persistence
  static fromData(data: {
    id: string;
    name: string;
    description: string;
    hierarchyLevel: number;
    permissions: Permission[];
    isDefault: boolean;
    isDefaultAppRole: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): Role {
    const role = new Role(
      RoleId.fromString(data.id),
      data.name,
      data.description,
      data.hierarchyLevel,
      data.isDefault,
      data.isDefaultAppRole,
      data.createdAt,
    );

    role._permissions = data.permissions;
    role._updatedAt = data.updatedAt;

    return role;
  }

  // Getters
  get id(): RoleId {
    return this._id;
  }

  get name(): string {
    return this._name;
  }

  get description(): string {
    return this._description;
  }

  get hierarchyLevel(): number {
    return this._hierarchyLevel;
  }

  get permissions(): Permission[] {
    return [...this._permissions]; // Return copy to prevent external mutation
  }

  get permissionsCollection(): PermissionsCollection {
    return PermissionsCollection.create(this._permissions);
  }

  get isDefault(): boolean {
    return this._isDefault;
  }

  get isDefaultAppRole(): boolean {
    return this._isDefaultAppRole;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  // Business methods
  addPermission(permission: Permission): void {
    // Use specification pattern for business rule validation
    const canAssignPermissionSpec = new CanAssignPermissionToRoleSpecification(permission);

    if (!canAssignPermissionSpec.isSatisfiedBy(this)) {
      throw new PermissionAlreadyAssignedException(permission.getPermissionName(), this._name);
    }

    this._permissions.push(permission);
    this._updatedAt = new Date();
  }

  removePermission(permissionId: PermissionId): void {
    const permissionExists = this._permissions.some(p => p.id.equals(permissionId));
    if (!permissionExists) {
      return; // Permission not found, no change needed
    }

    this._permissions = this._permissions.filter(p => !p.id.equals(permissionId));
    this._updatedAt = new Date();
  }

  updateDetails(name?: string, description?: string, hierarchyLevel?: number): void {
    let hasChanges = false;

    if (name && name !== this._name) {
      this.validateName(name);
      this._name = name;
      hasChanges = true;
    }

    if (description && description !== this._description) {
      this.validateDescription(description);
      this._description = description;
      hasChanges = true;
    }

    if (hierarchyLevel !== undefined && hierarchyLevel !== this._hierarchyLevel) {
      this.validateHierarchyLevel(hierarchyLevel);
      this._hierarchyLevel = hierarchyLevel;
      hasChanges = true;
    }

    if (hasChanges) {
      this._updatedAt = new Date();
    }
  }

  setAsDefault(): void {
    if (this._isDefault) {
      return; // Already default, no change needed
    }

    this._isDefault = true;
    this._updatedAt = new Date();
  }

  removeAsDefault(): void {
    if (!this._isDefault) {
      return; // Already not default, no change needed
    }

    this._isDefault = false;
    this._updatedAt = new Date();
  }

  // Query methods
  hasPermission(permissionId: PermissionId): boolean {
    return this._permissions.some(p => p.id.equals(permissionId));
  }

  hasPermissionByName(permissionName: string): boolean {
    return this.permissionsCollection.containsByName(permissionName);
  }

  isAdminRole(): boolean {
    // Business rule: Admin roles are identified by admin permissions or name
    return (
      this.permissionsCollection.hasAdminPermissions() ||
      this._name.toLowerCase().includes('admin') ||
      this._name.toLowerCase().includes('administrator')
    );
  }

  isRootRole(): boolean {
    // Business rule: Root role is the highest privilege level
    return this._name.toLowerCase() === RolesEnum.ROOT;
  }

  isRootReadOnlyRole(): boolean {
    // Business rule: Root readonly role has full read access but no write operations
    return this._name.toLowerCase() === RolesEnum.ROOT_READONLY;
  }

  isRootLevelRole(): boolean {
    // Business rule: Root level roles include both root and root_readonly
    return this.isRootRole() || this.isRootReadOnlyRole();
  }

  hasElevatedPrivileges(): boolean {
    // Business rule: Elevated privileges include root level
    return this.isRootLevelRole();
  }

  // Hierarchy-related business methods
  canCreateRoleWithLevel(targetHierarchyLevel: number): boolean {
    // Business rule: Can only create roles with hierarchy level >= own level (lower or equal privilege)
    // Cannot create root level roles (level 1)
    return targetHierarchyLevel >= this._hierarchyLevel && targetHierarchyLevel > 1;
  }

  hasHigherHierarchyThan(otherRole: Role): boolean {
    // Business rule: Lower number = higher hierarchy
    return this._hierarchyLevel < otherRole._hierarchyLevel;
  }

  hasLowerHierarchyThan(otherRole: Role): boolean {
    // Business rule: Higher number = lower hierarchy
    return this._hierarchyLevel > otherRole._hierarchyLevel;
  }

  hasSameHierarchyAs(otherRole: Role): boolean {
    return this._hierarchyLevel === otherRole._hierarchyLevel;
  }

  isRootHierarchy(): boolean {
    return this._hierarchyLevel === 1;
  }

  isAdminHierarchy(): boolean {
    return this._hierarchyLevel === 2;
  }

  isManagerHierarchy(): boolean {
    return this._hierarchyLevel === 3;
  }

  isSalesAgentOrHostHierarchy(): boolean {
    return this._hierarchyLevel === 4;
  }

  isGuestHierarchy(): boolean {
    return this._hierarchyLevel === 5;
  }

  getHierarchyLevelName(): string {
    switch (this._hierarchyLevel) {
      case 1:
        return 'Root';
      case 2:
        return 'Admin';
      case 3:
        return 'Manager';
      case 4:
        return 'Sales Agent/Host';
      case 5:
        return 'Guest';
      default:
        return 'Unknown';
    }
  }

  canBeDeleted(): boolean {
    // Business rule: Default roles and system roles cannot be deleted
    return !this._isDefault && !this._isDefaultAppRole;
  }

  validateForDeletion(): void {
    if (!this.canBeDeleted()) {
      throw new CannotDeleteDefaultRoleException();
    }
  }

  getPermissionNames(): string[] {
    return this._permissions.map(p => p.getPermissionName());
  }

  // Private validation methods
  private validateName(name: string): void {
    if (!name || name.trim().length === 0) {
      throw new InvalidValueObjectException('Role name cannot be empty');
    }

    if (name.length > 100) {
      throw new InvalidValueObjectException('Role name cannot exceed 100 characters');
    }
  }

  private validateDescription(description: string): void {
    if (!description || description.trim().length === 0) {
      throw new InvalidValueObjectException('Role description cannot be empty');
    }

    if (description.length > 500) {
      throw new InvalidValueObjectException('Role description cannot exceed 500 characters');
    }
  }

  private validateHierarchyLevel(hierarchyLevel: number): void {
    if (!Number.isInteger(hierarchyLevel) || hierarchyLevel < 1 || hierarchyLevel > 5) {
      throw new InvalidValueObjectException('Role hierarchy level must be between 1 and 5');
    }
  }
}
