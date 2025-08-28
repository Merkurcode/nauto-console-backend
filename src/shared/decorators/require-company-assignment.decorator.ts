import { applyDecorators, UseGuards } from '@nestjs/common';
import { CompanyAssignmentGuard } from '@presentation/guards/company-assignment.guard';

/**
 * Decorator to require company assignment for accessing endpoints
 *
 * This decorator:
 * - Ensures the user is assigned to a company (has companyId or tenantId)
 * - Allows root users to bypass this requirement
 * - Provides clear error messages for unassigned users
 *
 * @example
 * ```typescript
 * @Get('/company-data')
 * @RequireCompanyAssignment()
 * async getCompanyData() {
 *   // This endpoint requires user to be assigned to a company
 * }
 * ```
 */
export const RequireCompanyAssignment = () => applyDecorators(UseGuards(CompanyAssignmentGuard));
