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
  RootRoleSpecification,
  RootReadOnlyRoleSpecification,
  RootLevelRoleSpecification,
} from '@core/specifications/role.specifications';
import { BusinessRuleValidationException } from '@core/exceptions/domain-exceptions';
import { RolesEnum } from '@shared/constants/enums';
import {
  MIN_ROLE_NAME_LENGTH,
  SYSTEM_HELPERS,
} from '@shared/constants/system-constants';

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

    // Removed arbitrary permission limits - roles can have any number of permissions

    // Validate role name conventions
    if (role.name.length < MIN_ROLE_NAME_LENGTH) {
      result.addError('Role name must be at least 3 characters long.');
    }

    const rootRoleSpec = new RootRoleSpecification();
    if ((role.name.toLowerCase() === RolesEnum.ROOT.toLowerCase() ||
         role.name.toLowerCase() === RolesEnum.ROOT_READONLY.toLowerCase()) &&
        !rootRoleSpec.isSatisfiedBy(role)) {
      result.addWarning('Role name suggests root privileges but lacks root permissions.');
    }

    return result;
  }

  /**
   * Validate permission assignment business rules
   */
  validatePermissionAssignment(role: Role, permission: Permission): ValidationResult {
    const result = new ValidationResult();

    // Validate permission scope - system-critical permissions require root level roles
    if (SYSTEM_HELPERS.isSystemCriticalPermission(permission.getResource(), permission.getAction())) {
      const rootRoleSpec = new RootLevelRoleSpecification();
      if (!rootRoleSpec.isSatisfiedBy(role)) {
        result.addError('System-critical permissions can only be assigned to root level roles.');
      }
    }

    // Check if permission already exists in the role
    const permissionName = permission.getPermissionName();
    const hasPermission = role.permissions.some(existingPermission =>
      existingPermission.getPermissionName() === permissionName,
    );

    if (hasPermission) {
      result.addWarning(`Permission '${permissionName}' is already assigned to this role.`);
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
    if (SYSTEM_HELPERS.hasCommonPatterns(password)) {
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

    // Security validations when assigningUser is provided
    if (assigningUser) {
      // Rule 1: Cannot alter root users (only if you are root yourself)
      const rootUserSpec = new RootLevelUserSpecification();
      const targetIsRoot = rootUserSpec.isSatisfiedBy(user);
      const assignerIsRoot = rootUserSpec.isSatisfiedBy(assigningUser);
      
      if (targetIsRoot && !assignerIsRoot) {
        result.addError('Only ROOT users can modify other ROOT users.');
      }

      // Rule 3: Cannot alter users from other companies (only root users can)
      if (!assignerIsRoot && user.companyId && assigningUser.companyId) {
        if (!user.companyId.equals(assigningUser.companyId)) {
          result.addError('You can only modify users from your own company.');
        }
      }

      // Rule 2: Cannot assign roles superior in hierarchy to yours (root users can assign any)
      if (!assignerIsRoot) {
        const assignerHighestRole = assigningUser.getHighestHierarchyRole();
        if (assignerHighestRole && role.hasHigherHierarchyThan(assignerHighestRole)) {
          result.addError('You cannot assign roles with higher hierarchy than your own.');
        }
      }
    }

    // Rule 4: Prohibited to assign root role or hierarchy superior/equal to root
    const rootRoleSpec = new RootRoleSpecification();
    const rootReadOnlyRoleSpec = new RootReadOnlyRoleSpecification();

    if (rootRoleSpec.isSatisfiedBy(role)) {
      result.addError('ROOT role assignment is prohibited through this endpoint.');
    }

    if (rootReadOnlyRoleSpec.isSatisfiedBy(role)) {
      result.addError('ROOT_READONLY role assignment is prohibited through this endpoint.');
    }

    // Additional ROOT role assignment restrictions for other cases
    if ((rootRoleSpec.isSatisfiedBy(role) || rootReadOnlyRoleSpec.isSatisfiedBy(role)) && assigningUser) {
      // Only ROOT users can assign ROOT roles (if somehow allowed)
      const rootUserSpec = new RootLevelUserSpecification();
      if (!rootUserSpec.isSatisfiedBy(assigningUser)) {
        result.addError('Only ROOT users can assign ROOT level roles.');
      }
    }

    // Check BOT role assignment restrictions
    if (role.name === RolesEnum.BOT && assigningUser) {
      // Only ROOT users can assign BOT role
      const rootUserSpec = new RootLevelUserSpecification();
      if (!rootUserSpec.isSatisfiedBy(assigningUser)) {
        result.addError('Only ROOT users can assign BOT role.');
      }
    }

    // Check if role has system or audit permissions - only root can assign these
    if (assigningUser && this.hasSystemOrAuditPermissions(role)) {
      const rootUserSpec = new RootLevelUserSpecification();
      if (!rootUserSpec.isSatisfiedBy(assigningUser)) {
        result.addError('Only ROOT users can assign roles with system or audit permissions.');
      }

      // Additionally, roles with system/audit permissions can only be assigned to root users
      const rootLevelRoleSpec = new RootLevelRoleSpecification();
      if (!rootLevelRoleSpec.isSatisfiedBy(role) && !user.rolesCollection.containsByName(RolesEnum.ROOT)) {
        result.addError('Roles with system or audit permissions can only be assigned to ROOT users.');
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

  private findConflictingRoles(existingRoles: Role[], newRole: Role): string[] {
    const conflicts: string[] = [];
    const newRoleName = newRole.name.toLowerCase();

    // Reglas simples y claras de conflictos de roles:
    // 1. ROOT es incompatible con todos los demás roles, EXCEPTO BOT
    // 2. BOT es incompatible con todos excepto ROOT
    // 3. Todos los demás roles se pueden mezclar sin problema

    for (const existingRole of existingRoles) {
      const existingRoleName = existingRole.name.toLowerCase();

      // Si el nuevo rol es ROOT, es incompatible con cualquier rol excepto BOT
      if (newRoleName === RolesEnum.ROOT && existingRoleName !== RolesEnum.ROOT && existingRoleName !== RolesEnum.BOT) {
        conflicts.push(existingRole.name);
      }
      // Si el nuevo rol es BOT, es incompatible con todos excepto ROOT
      else if (newRoleName === RolesEnum.BOT && existingRoleName !== RolesEnum.ROOT && existingRoleName !== RolesEnum.BOT) {
        conflicts.push(existingRole.name);
      }
      // Si ya existe ROOT, cualquier nuevo rol (excepto ROOT y BOT) es incompatible
      else if (existingRoleName === RolesEnum.ROOT && newRoleName !== RolesEnum.ROOT && newRoleName !== RolesEnum.BOT) {
        conflicts.push(existingRole.name);
      }
      // Si ya existe BOT, cualquier nuevo rol (excepto ROOT y BOT) es incompatible
      else if (existingRoleName === RolesEnum.BOT && newRoleName !== RolesEnum.ROOT && newRoleName !== RolesEnum.BOT) {
        conflicts.push(existingRole.name);
      }
    }

    // Extensión futura: Agregar conflictos personalizados aquí si es necesario
    const customConflicts = this.getCustomRoleConflicts(newRoleName, existingRoles);
    conflicts.push(...customConflicts);

    return conflicts;
  }

  /**
   * Método para agregar conflictos personalizados en el futuro
   * Facilita la extensión sin modificar la lógica principal
   */
  private getCustomRoleConflicts(_newRoleName: string, _existingRoles: Role[]): string[] {
    const customConflicts: string[] = [];

    // Ejemplo de como agregar conflictos específicos en el futuro:
    // if (newRoleName === 'custom_role_1') {
    //   for (const existingRole of existingRoles) {
    //     if (existingRole.name === 'custom_role_2') {
    //       customConflicts.push(existingRole.name);
    //     }
    //   }
    // }

    return customConflicts;
  }

  // Functions moved to SYSTEM_HELPERS in system-constants.ts

  private hasSystemOrAuditPermissions(role: Role): boolean {
    return role.permissions.some(permission => {
      return SYSTEM_HELPERS.isSystemOrAuditResource(permission.getResource());
    });
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
