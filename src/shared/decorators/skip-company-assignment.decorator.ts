import { SetMetadata } from '@nestjs/common';

export const SKIP_COMPANY_ASSIGNMENT_KEY = 'skipCompanyAssignment';

/**
 * Decorator to skip company assignment validation for specific endpoints
 *
 * Use this decorator when:
 * - The endpoint should be accessible to users without company assignment
 * - Root users need unrestricted access
 * - Public endpoints or initial setup flows
 *
 * @example
 * ```typescript
 * @Get('/public-info')
 * @SkipCompanyAssignment()
 * async getPublicInfo() {
 *   // This endpoint is accessible even without company assignment
 * }
 * ```
 */
export const SkipCompanyAssignment = () => SetMetadata(SKIP_COMPANY_ASSIGNMENT_KEY, true);
