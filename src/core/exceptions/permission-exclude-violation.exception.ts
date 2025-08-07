import { RoleDomainException } from '@core/exceptions/domain-exceptions';

export class PermissionExcludeViolationException extends RoleDomainException {
  constructor(roleName: string, permissionName: string, excludeRoles: string[]) {
    super(
      `Role '${roleName}' is excluded from permission '${permissionName}'. ` +
        `Excluded roles: ${excludeRoles.includes('*') ? 'ALL' : excludeRoles.join(', ')}`,
      'PERMISSION_EXCLUDE_VIOLATION',
      { roleName, permissionName, excludeRoles },
    );
  }
}
