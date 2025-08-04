import { RoleDomainException } from '@core/exceptions/domain-exceptions';
import { HttpStatus } from '@nestjs/common';

export class PermissionExcludeViolationException extends RoleDomainException {
  constructor(roleName: string, permissionName: string, excludeRoles: string[]) {
    super(
      `Role '${roleName}' is excluded from permission '${permissionName}'. ` +
        `Excluded roles: ${excludeRoles.includes('*') ? 'ALL' : excludeRoles.join(', ')}`,
      HttpStatus.FORBIDDEN,
    );
  }
}
