import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Inject } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request } from 'express';
import { ILogger } from '@core/interfaces/logger.interface';
import { LOGGER_SERVICE } from '@shared/constants/tokens';

/**
 * Security events that should be audited
 */
enum SecurityEvent {
  UNAUTHORIZED_ACCESS_ATTEMPT = 'unauthorized_access_attempt',
  SUSPICIOUS_FILE_UPLOAD = 'suspicious_file_upload',
  PRIVILEGE_ESCALATION_ATTEMPT = 'privilege_escalation_attempt',
  UNUSUAL_FILE_OPERATION = 'unusual_file_operation',
  MASS_OPERATION_ATTEMPT = 'mass_operation_attempt',
  INVALID_INPUT_DETECTED = 'invalid_input_detected',
}

/**
 * Interceptor for security auditing and monitoring
 * Logs security-relevant events and suspicious activities
 */
@Injectable()
export class SecurityAuditInterceptor implements NestInterceptor {
  constructor(
    @Inject(LOGGER_SERVICE)
    private readonly logger: ILogger,
  ) {
    this.logger.setContext(SecurityAuditInterceptor.name);
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const startTime = Date.now();

    // Extract user information
    const user = (request as any).user;
    const userId = user?.sub || 'anonymous';
    const userRole = user?.roles?.[0] || 'guest';
    const companyId = user?.companyId || 'unknown';

    // Extract request information
    const method = request.method;
    const url = request.url;
    const userAgent = request.headers['user-agent'] || 'unknown';
    const clientIp = this.getClientIp(request);

    // Check for suspicious patterns before processing
    this.checkSuspiciousActivity(request, userId, userRole);

    return next.handle().pipe(
      tap(data => {
        const duration = Date.now() - startTime;

        // Log successful operations
        this.logger.log({
          event: 'file_operation_success',
          userId,
          userRole,
          companyId,
          method,
          url,
          duration,
          clientIp,
          userAgent: this.truncateUserAgent(userAgent),
        });

        // Check for unusual patterns in successful operations
        this.checkUnusualSuccessPatterns(method, url, data, userId, userRole);
      }),
      catchError(error => {
        const duration = Date.now() - startTime;

        // Log failed operations with security context
        this.logger.error({
          event: 'file_operation_failure',
          userId,
          userRole,
          companyId,
          method,
          url,
          duration,
          clientIp,
          userAgent: this.truncateUserAgent(userAgent),
          error: error.message,
          errorType: error.constructor.name,
        });

        // Check for security-relevant failures
        this.checkSecurityFailures(error, userId, userRole, method, url, clientIp);

        return throwError(() => error);
      }),
    );
  }

  /**
   * Extract real client IP considering proxies
   */
  private getClientIp(request: Request): string {
    const forwarded = request.headers['x-forwarded-for'];
    const forwardedIp = Array.isArray(forwarded) ? forwarded[0] : forwarded;

    return (
      forwardedIp?.split(',')[0]?.trim() ||
      (request.headers['x-real-ip'] as string) ||
      request.socket?.remoteAddress ||
      'unknown'
    );
  }

  /**
   * Truncate user agent to prevent log pollution
   */
  private truncateUserAgent(userAgent: string): string {
    return userAgent.length > 200 ? userAgent.substring(0, 200) + '...' : userAgent;
  }

  /**
   * Check for suspicious activity patterns
   */
  private checkSuspiciousActivity(request: Request, userId: string, userRole: string): void {
    const url = request.url;
    const method = request.method;
    const body = request.body;

    // Check for path traversal attempts in URL
    if (url.includes('..') || url.includes('%2e%2e')) {
      this.logSecurityEvent(SecurityEvent.SUSPICIOUS_FILE_UPLOAD, {
        userId,
        userRole,
        reason: 'Path traversal attempt in URL',
        url,
        method,
      });
    }

    // Check for suspicious filenames in upload requests
    if (body?.filename || body?.originalName) {
      const filename = body.filename || body.originalName;

      // Check for executable file extensions
      const dangerousExtensions = [
        '.exe',
        '.bat',
        '.cmd',
        '.com',
        '.pif',
        '.scr',
        '.vbs',
        '.js',
        '.jar',
      ];
      const hasExt = dangerousExtensions.some(ext => filename.toLowerCase().endsWith(ext));

      if (hasExt) {
        this.logSecurityEvent(SecurityEvent.SUSPICIOUS_FILE_UPLOAD, {
          userId,
          userRole,
          reason: 'Potentially dangerous file extension',
          filename,
          method,
        });
      }

      // Check for hidden files or system files
      if (filename.startsWith('.') || filename.toLowerCase().includes('system')) {
        this.logSecurityEvent(SecurityEvent.SUSPICIOUS_FILE_UPLOAD, {
          userId,
          userRole,
          reason: 'Hidden or system file upload attempt',
          filename,
          method,
        });
      }
    }

    // Check for admin endpoint access by non-admin users
    if (url.includes('/concurrency/') && !['root', 'root_readonly'].includes(userRole)) {
      this.logSecurityEvent(SecurityEvent.PRIVILEGE_ESCALATION_ATTEMPT, {
        userId,
        userRole,
        reason: 'Admin endpoint access by non-admin user',
        url,
        method,
      });
    }

    // Note: File size limits are handled by tier-based quota system, not fixed limits
  }

  /**
   * Check for unusual patterns in successful operations
   */
  private checkUnusualSuccessPatterns(
    method: string,
    url: string,
    data: any,
    userId: string,
    userRole: string,
  ): void {
    // Check for mass file operations
    if (data?.deletedCount && data.deletedCount > 100) {
      this.logSecurityEvent(SecurityEvent.MASS_OPERATION_ATTEMPT, {
        userId,
        userRole,
        reason: 'Large number of files affected in single operation',
        affectedCount: data.deletedCount,
        method,
        url,
      });
    }

    // Check for unusual folder operations
    if (url.includes('/folders') && method === 'DELETE') {
      this.logSecurityEvent(SecurityEvent.UNUSUAL_FILE_OPERATION, {
        userId,
        userRole,
        reason: 'Folder deletion operation',
        method,
        url,
      });
    }

    // Log all admin operations for audit trail
    if (url.includes('/concurrency/')) {
      this.logger.warn({
        event: 'admin_operation_performed',
        userId,
        userRole,
        operation: `${method} ${url}`,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Check for security-relevant failures
   */
  private checkSecurityFailures(
    error: any,
    userId: string,
    userRole: string,
    method: string,
    url: string,
    clientIp: string,
  ): void {
    const errorMessage = error.message?.toLowerCase() || '';

    // Access denied errors
    if (
      errorMessage.includes('access denied') ||
      errorMessage.includes('insufficient permissions')
    ) {
      this.logSecurityEvent(SecurityEvent.UNAUTHORIZED_ACCESS_ATTEMPT, {
        userId,
        userRole,
        reason: 'Access denied to protected resource',
        method,
        url,
        clientIp,
        errorMessage: error.message,
      });
    }

    // Authentication failures
    if (errorMessage.includes('unauthorized') || error.status === 401) {
      this.logSecurityEvent(SecurityEvent.UNAUTHORIZED_ACCESS_ATTEMPT, {
        userId,
        userRole,
        reason: 'Authentication failure',
        method,
        url,
        clientIp,
        errorMessage: error.message,
      });
    }

    // Validation failures that might indicate malicious input
    if (errorMessage.includes('validation failed') || errorMessage.includes('invalid')) {
      this.logSecurityEvent(SecurityEvent.INVALID_INPUT_DETECTED, {
        userId,
        userRole,
        reason: 'Input validation failure',
        method,
        url,
        clientIp,
        errorMessage: error.message,
      });
    }
  }

  /**
   * Log security events with structured format
   */
  private logSecurityEvent(event: SecurityEvent, details: Record<string, any>): void {
    this.logger.warn({
      securityEvent: event,
      timestamp: new Date().toISOString(),
      severity: 'HIGH',
      ...details,
    });
  }
}
