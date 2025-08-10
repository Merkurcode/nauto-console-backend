/**
 * Path constants for consistent configuration across interceptors and middleware
 */

/**
 * Paths that should skip request integrity verification
 * These are typically public endpoints that don't require signature validation
 */
export const REQUEST_INTEGRITY_SKIP_PATHS = [
  // Health endpoints (all public)
  '/api/health',
  '/api/health/database',
  '/api/health/ready',
  '/api/health/live',

  // Auth endpoints (public endpoints only)
  '/api/auth/login',
  '/api/auth/verify-otp',
  '/api/auth/refresh-token',
  '/api/auth/email/verify',
  '/api/auth/password/request-reset',
  '/api/auth/password/reset',

  // Company endpoints (public)
  '/api/companies/by-host',

  // Documentation and root
  '/docs', // Swagger docs
  '/swagger', // Swagger static assets
  '/', // Root
];

/**
 * Critical endpoint patterns that should always be logged in audit
 * These endpoints contain sensitive operations and should never be skipped
 */
export const AUDIT_CRITICAL_PATTERNS = [
  '/api/auth/', // Authentication endpoints
  '/api/admin/', // Administrative operations
  '/api/root/', // Root operations
  '/api/users/', // User management (if contains sensitive operations)
  '/api/roles/', // Role management
  '/api/permissions/', // Permission management
];

/**
 * Paths that should skip audit logging
 * These are typically non-critical endpoints like health checks and static assets
 */
export const AUDIT_SKIP_PATTERNS = [
  '/health',
  '/metrics',
  '/favicon.ico',
  '/robots.txt',
  '/.well-known',
  '/api/health',
  '/api/metrics',
  '/docs', // Swagger documentation
  '/api-json', // Swagger JSON
];
