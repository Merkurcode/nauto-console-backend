import { SetMetadata } from '@nestjs/common';
import { RolesEnum } from '@shared/constants/enums';

/**
 * Decorator to mark endpoints as requiring admin access
 * Used with the enhanced PermissionsGuard
 */
export const RequiresAdmin = () => SetMetadata(RolesEnum.ADMIN, true);
