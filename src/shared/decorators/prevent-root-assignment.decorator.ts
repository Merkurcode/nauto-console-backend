import { SetMetadata } from '@nestjs/common';

export const PREVENT_ROOT_ASSIGNMENT_KEY = 'prevent_root_assignment';

/**
 * Decorator to prevent non-root users from assigning ROOT or ROOT_READONLY roles
 * Only ROOT users can assign ROOT or ROOT_READONLY roles
 */
export const PreventRootAssignment = () => SetMetadata(PREVENT_ROOT_ASSIGNMENT_KEY, true);
