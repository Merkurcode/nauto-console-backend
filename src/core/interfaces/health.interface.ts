/**
 * Health Domain Interface - DEPRECATED
 *
 * This file is deprecated. Health response interfaces have been moved to:
 * @see @application/dtos/_responses/health/health.response.interface
 *
 * This file is kept temporarily for backward compatibility but will be removed in future versions.
 */

// Re-export from new location for backward compatibility
export {
  IHealthResponse,
  IDatabaseHealthResponse,
  IReadinessResponse,
  ILivenessResponse,
  IHealthCheckDetail,
  IComprehensiveHealthResponse,
} from '@application/dtos/_responses/health/health.response.interface';

