import { SetMetadata } from '@nestjs/common';

export const PREVENT_SUPERADMIN_ASSIGNMENT_KEY = 'prevent_superadmin_assignment';

/**
 * Decorator to prevent admin users from assigning SUPERADMIN role
 * Only SUPERADMIN users can assign SUPERADMIN role
 */
export const PreventSuperAdminAssignment = () =>
  SetMetadata(PREVENT_SUPERADMIN_ASSIGNMENT_KEY, true);
