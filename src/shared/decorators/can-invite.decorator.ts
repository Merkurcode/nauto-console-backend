import { SetMetadata } from '@nestjs/common';

export const CAN_INVITE_KEY = 'canInvite';

/**
 * Decorator to specify invitation permissions
 * @param roles - Array of roles that can be invited
 */
export const CanInvite = (...roles: string[]) => SetMetadata(CAN_INVITE_KEY, roles);
