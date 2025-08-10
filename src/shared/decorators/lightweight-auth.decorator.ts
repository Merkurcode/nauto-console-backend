import { SetMetadata } from '@nestjs/common';

/**
 * Decorator for endpoints that only need basic JWT validation without heavy database queries
 *
 * This decorator tells the guards to skip:
 * - Full user profile loading
 * - Roles and permissions loading
 * - Session activity updates
 * - Complex validation chains
 *
 * Perfect for endpoints like /api/auth/me that only need JWT claims
 */
export const LIGHTWEIGHT_AUTH_KEY = 'lightweightAuth';
export const LightweightAuth = () => SetMetadata(LIGHTWEIGHT_AUTH_KEY, true);
