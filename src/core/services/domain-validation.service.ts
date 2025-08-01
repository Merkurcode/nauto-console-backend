/* eslint-disable prettier/prettier */
import { Injectable } from '@nestjs/common';
import { User } from '@core/entities/user.entity';
import { Role } from '@core/entities/role.entity';
import { Permission } from '@core/entities/permission.entity';
import { Email } from '@core/value-objects/email.vo';
import { Password } from '@core/value-objects/password.vo';
import {
  ActiveUserSpecification,
  CompleteUserAccountSpecification,
  RootLevelUserSpecification,
} from '@core/specifications/user.specifications';
import {
  DefaultRoleSpecification,
  RootRoleSpecification,
  RootReadOnlyRoleSpecification,
  RootLevelRoleSpecification,
  HasMinimumPermissionsSpecification,
} from '@core/specifications/role.specifications';
import { BusinessRuleValidationException } from '@core/exceptions/domain-exceptions';

/**
 * Domain Validation Service for complex business rule validation
 * Encapsulates cross-entity validation logic using specifications
 */
@Injectable()
export class DomainValidationService {
  /**
   * Validate user account completeness and business rules
   */
  validateUserAccount(user: User): ValidationResult {
    const result = new ValidationResult();

    // Check account completeness
    const completeAccountSpec = new CompleteUserAccountSpecification();
    if (!completeAccountSpec.isSatisfiedBy(user)) {
      result.addError('User account is incomplete. Missing required information.');
    }

    // Validate email format (additional to entity validation)
    try {
      new Email(user.email.getValue());
    } catch (_) {
      result.addError('User email format is invalid.');
    }

    // Validate user has at least one role
    if (user.roles.length === 0) {
      result.addError('User must have at least one role assigned.');
    }

    // Root users must have 2FA enabled
    const rootSpec = new RootLevelUserSpecification();
    if (rootSpec.isSatisfiedBy(user) && !user.otpEnabled) {
      result.addWarning('Root level users should have two-factor authentication enabled.');
    }

    return result;
  }

  /**
   * Validate role configuration and business rules
   */
  validateRole(role: Role): ValidationResult {
    const result = new ValidationResult();

    // Check minimum permissions for non-default roles
    const defaultRoleSpec = new DefaultRoleSpecification();
    const minPermissionsSpec = new HasMinimumPermissionsSpecification(1);

    if (!defaultRoleSpec.isSatisfiedBy(role) && !minPermissionsSpec.isSatisfiedBy(role)) {
      result.addError('Non-default roles must have at least one permission.');
    }

    // Root roles should have substantial permissions
    const rootRoleSpec = new RootLevelRoleSpecification();
    const minRootPermissionsSpec = new HasMinimumPermissionsSpecification(10);

    if (rootRoleSpec.isSatisfiedBy(role) && !minRootPermissionsSpec.isSatisfiedBy(role)) {
      result.addWarning(
        'Root level roles should have at least 10 permissions for proper functionality.',
      );
    }

    // Validate role name conventions
    if (role.name.length < 3) {
      result.addError('Role name must be at least 3 characters long.');
    }

    if (role.name.toLowerCase().includes('root') && !rootRoleSpec.isSatisfiedBy(role)) {
      result.addWarning('Role name suggests root privileges but lacks root permissions.');
    }

    return result;
  }

  /**
   * Validate permission assignment business rules
   */
  validatePermissionAssignment(role: Role, permission: Permission): ValidationResult {
    const result = new ValidationResult();

    // Check for conflicting permissions
    const conflictingPermissions = this.findConflictingPermissions(role, permission);
    if (conflictingPermissions.length > 0) {
      result.addWarning(
        `Permission may conflict with existing permissions: ${conflictingPermissions.join(', ')}`,
      );
    }

    // Validate permission scope
    if (this.isSystemCriticalPermission(permission)) {
      const rootRoleSpec = new RootLevelRoleSpecification();
      if (!rootRoleSpec.isSatisfiedBy(role)) {
        result.addError('System-critical permissions can only be assigned to root level roles.');
      }
    }

    return result;
  }

  /**
   * Validate password complexity beyond basic requirements
   */
  validatePasswordComplexity(password: string): ValidationResult {
    const result = new ValidationResult();

    try {
      new Password(password); // Basic validation
    } catch (error) {
      result.addError(error.message);

      return result;
    }

    // Additional complexity checks
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/.test(password)) {
      result.addWarning(
        'Password should contain uppercase, lowercase, numbers, and special characters for maximum security.',
      );
    }

    // Check for common patterns
    if (this.hasCommonPatterns(password)) {
      result.addWarning('Password contains common patterns that may reduce security.');
    }

    return result;
  }

  /**
   * Validate business rule compliance for user role assignment
   */
  validateRoleAssignment(user: User, role: Role, assigningUser?: User): ValidationResult {
    const result = new ValidationResult();

    // User must be active
    const activeUserSpec = new ActiveUserSpecification();
    if (!activeUserSpec.isSatisfiedBy(user)) {
      result.addError('Cannot assign roles to inactive users.');
    }

    // Check ROOT role assignment restrictions
    const rootRoleSpec = new RootRoleSpecification();
    const rootReadOnlyRoleSpec = new RootReadOnlyRoleSpecification();

    if (rootRoleSpec.isSatisfiedBy(role) && assigningUser) {
      // Only ROOT users can assign ROOT role
      const rootUserSpec = new RootLevelUserSpecification();
      if (!rootUserSpec.isSatisfiedBy(assigningUser)) {
        result.addError('Only ROOT users can assign ROOT role.');
      }
    }

    if (rootReadOnlyRoleSpec.isSatisfiedBy(role) && assigningUser) {
      // Only ROOT users can assign ROOT_READONLY role
      const rootUserSpec = new RootLevelUserSpecification();
      if (!rootUserSpec.isSatisfiedBy(assigningUser)) {
        result.addError('Only ROOT users can assign ROOT_READONLY role.');
      }
    }

    // Check role compatibility for root level roles
    const rootLevelRoleSpec = new RootLevelRoleSpecification();
    if (rootLevelRoleSpec.isSatisfiedBy(role)) {
      // Validate root role assignment requirements
      if (!user.isEligibleForRootRole()) {
        result.addError('User is not eligible for root role assignment.');
      }

      if (!user.otpEnabled) {
        result.addWarning('Root role assignment requires 2FA to be enabled.');
      }
    }

    // Check for role conflicts
    const conflictingRoles = this.findConflictingRoles(user.roles, role);
    if (conflictingRoles.length > 0) {
      result.addWarning(`Role may conflict with existing roles: ${conflictingRoles.join(', ')}`);
    }

    return result;
  }

  // Private helper methods
  private findConflictingPermissions(role: Role, newPermission: Permission): string[] {
    const conflicts: string[] = [];

    // Define permission conflicts (in a real app, this might come from configuration)
    const conflictRules = new Map([
      ['user:delete', ['user:create', 'user:update']], // Deletion might conflict with creation/update workflows
      ['system:shutdown', ['system:startup']], // System state conflicts
    ]);

    const newPermissionName = newPermission.getPermissionName();
    const conflictList = conflictRules.get(newPermissionName) || [];

    for (const existingPermission of role.permissions) {
      if (conflictList.includes(existingPermission.getPermissionName())) {
        conflicts.push(existingPermission.getPermissionName());
      }
    }

    return conflicts;
  }

  private findConflictingRoles(existingRoles: Role[], newRole: Role): string[] {
    const conflicts: string[] = [];

    // Define role conflicts
    const roleConflicts = new Map([
      ['root', ['guest', 'readonly', 'admin', 'manager', 'sales_agent']],
      ['root_readonly', ['guest', 'admin', 'manager', 'sales_agent']],
      ['admin', ['guest', 'sales_agent']],
      ['manager', ['guest', 'sales_agent']],
      ['sales_agent', ['guest']],
    ]);

    const newRoleName = newRole.name.toLowerCase();
    const conflictList = roleConflicts.get(newRoleName) || [];

    for (const existingRole of existingRoles) {
      if (conflictList.includes(existingRole.name.toLowerCase())) {
        conflicts.push(existingRole.name);
      }
    }

    return conflicts;
  }

  private isSystemCriticalPermission(permission: Permission): boolean {
    const criticalActions = ['delete', 'shutdown', 'configure'];
    const criticalResources = ['system', 'database', 'security'];

    return (
      criticalActions.includes(permission.getAction().toLowerCase()) ||
      criticalResources.includes(permission.getResource().toLowerCase())
    );
  }

  private hasCommonPatterns(password: string): boolean {
    const commonPatterns = [
      /123/, // Sequential numbers
      /abc/i, // Sequential letters
      /password/i, // Common word
      /qwerty/i, // Keyboard pattern
      /(.)\1{2,}/, // Repeated characters
    ];

    return commonPatterns.some(pattern => pattern.test(password));
  }
}

/**
 * Validation result container
 */
export class ValidationResult {
  private readonly errors: string[] = [];
  private readonly warnings: string[] = [];

  addError(message: string): void {
    this.errors.push(message);
  }

  addWarning(message: string): void {
    this.warnings.push(message);
  }

  get isValid(): boolean {
    return this.errors.length === 0;
  }

  get hasWarnings(): boolean {
    return this.warnings.length > 0;
  }

  getErrors(): string[] {
    return [...this.errors];
  }

  getWarnings(): string[] {
    return [...this.warnings];
  }

  getAllMessages(): string[] {
    return [...this.errors, ...this.warnings];
  }

  throwIfInvalid(): void {
    if (!this.isValid) {
      throw new BusinessRuleValidationException(this.errors.join('; '));
    }
  }
}
