// Re-export health interfaces from core layer for backward compatibility
export {
  IHealthResponse,
  IDatabaseHealthResponse,
  IReadinessResponse,
  ILivenessResponse,
  IHealthCheckDetail,
  IComprehensiveHealthResponse,
} from '@core/interfaces/health.interface';
