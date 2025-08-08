import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key for skipping tenant isolation
 */
export const SKIP_TENANT_KEY = 'skip_tenant';

/**
 * Decorator to skip tenant isolation on specific endpoints
 * Use this decorator on public endpoints that don't require tenant context
 *
 * @example
 * ```typescript
 * @Post('login')
 * @SkipTenant()
 * @Public()
 * async login(@Body() loginDto: LoginDto) {
 *   // This endpoint won't enforce tenant isolation
 * }
 * ```
 */
export const SkipTenant = () => SetMetadata(SKIP_TENANT_KEY, true);
