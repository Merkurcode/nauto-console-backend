import { RoleDomainException } from '@core/exceptions/domain-exceptions';

export class PermissionExcludeViolationException extends RoleDomainException {
  constructor(roleName: string, permissionName: string, excludeRoles: string[]) {
    super(
      // SECURITY: Generic message to avoid exposing role hierarchy
      'Permission assignment not allowed for this role',
      'PERMISSION_EXCLUDE_VIOLATION',
      { roleName, permissionName, excludeRoles },
    );
  }
}
