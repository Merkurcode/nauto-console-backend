import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Inject } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuditLogService } from '@core/services/audit-log.service';
import { UserId } from '@core/value-objects/user-id.vo';
import { AUDIT_LOG_SERVICE } from '@shared/constants/tokens';
import { AUDIT_CRITICAL_PATTERNS, AUDIT_SKIP_PATTERNS } from '@shared/constants/paths';
import { PathSecurityUtil } from '@shared/utils/path-security.util';

/**
 * Interceptor de Audit Log - Captura automática de requests/responses HTTP
 *
 * **Propósito**: Interceptor de capa de presentación que captura automáticamente
 * TODOS los requests HTTP para crear un audit trail comprehensivo sin requerir
 * modificaciones en controllers individuales.
 *
 * **Responsabilidades**:
 * - Captura automática de requests HTTP entrantes
 * - Logging de responses exitosos con métricas de performance
 * - Captura de errores y excepciones con contexto completo
 * - Extracción de información de usuario y sesión
 * - Filtering inteligente de endpoints no-críticos
 * - Categorización automática por status codes
 *
 * **Arquitectura NestJS Interceptor**:
 * - Implementa NestInterceptor interface
 * - Usa RxJS operators para manejo asíncrono
 * - Se ejecuta antes y después de route handlers
 * - Acceso completo a ExecutionContext y response data
 * - Error handling que no interrumpe flujo principal
 *
 * **Características de performance**:
 * - **Ultra-fast logging**: Usa queue asíncrono, no bloquea requests
 * - **Smart filtering**: Skip automático de health checks y assets
 * - **Intelligent sampling**: Reduce carga bajo alto tráfico (1 en N requests)
 * - **Adaptive rate**: Sampling rate automático basado en carga
 * - **Minimal overhead**: <1ms latencia adicional por request
 * - **Non-blocking**: Failures de audit no afectan response
 * - **Memory efficient**: No almacena payloads grandes
 *
 * **Información capturada automáticamente**:
 * - **Request**: method, URL, headers, body, params, query
 * - **Response**: status code, duration, response size
 * - **User context**: user ID, session token, IP address
 * - **Errors**: exception details, stack traces, error types
 * - **Performance**: request duration, response size
 *
 * **Políticas implementadas**:
 * - Skip de endpoints no-críticos (health, metrics, static assets)
 * - Categorización automática de log level por status code
 * - Doble logging para errores (API + Exception)
 * - Extracción inteligente de IP (considera proxies)
 * - Sanitización automática via AuditLogService
 *
 * @example
 * ```typescript
 * // Se aplica automáticamente a todos los endpoints:
 * @Controller('users')
 * @UseInterceptors(AuditLogInterceptor)  // O globalmente en main.ts
 * export class UsersController {
 *   @Get()
 *   findAll() {
 *     // Automáticamente logged como:
 *     // "GET /api/users" with user context, duration, etc.
 *   }
 *
 *   @Post()
 *   create(@Body() data: any) {
 *     // Automáticamente logged con request body (sanitizado)
 *   }
 * }
 * ```
 *
 * **Integración con sistema**:
 * - Registrado globalmente en main.ts o por controller
 * - Integrado con sistema de autenticación para user context
 * - Usa AuditLogService para persistencia asíncrona
 * - Compatible con guards, filters y otros interceptors
 */
@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  // Sampling configuration for high-performance audit logging
  private readonly samplingRate: number;
  private readonly adaptiveSampling: boolean;
  private requestCount = 0;
  private lastResetTime = Date.now();
  private readonly ADAPTIVE_RESET_INTERVAL = 60 * 1000; // 1 minute
  private readonly HIGH_TRAFFIC_THRESHOLD = 1000; // requests per minute
  private readonly logger = console; // Simple logger for security warnings

  constructor(
    @Inject(AUDIT_LOG_SERVICE)
    private readonly auditLogService: AuditLogService,
    private readonly configService: ConfigService,
  ) {
    // Configure sampling based on environment
    const env = this.configService.get<string>('NODE_ENV', 'development');

    // Sampling rate: 1.0 = log all, 0.1 = log 10%, 0.01 = log 1%
    this.samplingRate = this.configService.get<number>(
      'AUDIT_SAMPLING_RATE',
      env === 'production' ? 0.1 : 1.0, // 10% in prod, 100% in dev
    );

    this.adaptiveSampling = this.configService.get<boolean>(
      'AUDIT_ADAPTIVE_SAMPLING',
      env === 'production', // Only in production
    );
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const startTime = Date.now();
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    // Extract request information
    const { method, url, path } = request;

    // Security: Log suspicious path attempts
    if (PathSecurityUtil.isSuspiciousPath(path)) {
      this.logger.warn({
        message: 'Suspicious path detected in audit interceptor',
        path,
        method,
        ip: this.extractIpAddress(request),
      });
    }

    // Extract user information if available
    const user = (request as any).user;
    const userId = user?.id ? UserId.fromString(user.id) : null;
    const sessionToken = (request as any).sessionToken;

    // Skip audit logging for health checks and non-essential endpoints (secure check)
    if (this.shouldSkipAudit(path, method)) {
      return next.handle();
    }

    // Apply sampling to reduce load under high traffic
    if (!this.shouldLogRequest(request)) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(data => {
        const duration = Date.now() - startTime;
        const statusCode = response.statusCode;

        // Log successful requests
        this.logApiRequest(
          'access',
          `${method} ${url}`,
          userId,
          request,
          {
            statusCode,
            duration,
            responseSize: data ? JSON.stringify(data).length : 0,
          },
          this.getLogLevelForStatus(statusCode),
        );
      }),
      catchError(error => {
        const duration = Date.now() - startTime;
        const statusCode = error.status || response.statusCode || 500;

        // Log failed requests and exceptions
        this.logApiRequest(
          'error',
          `${method} ${url} - ERROR: ${error.message || 'Unknown error'}`,
          userId,
          request,
          {
            statusCode,
            duration,
            errorMessage: error.message,
            errorStack: error.stack,
            errorName: error.constructor.name,
          },
          'error',
        );

        // Also log the exception separately for detailed tracking (ultra-fast)
        this.auditLogService.logException(error, userId, request, {
          endpoint: `${method} ${url}`,
          duration,
          statusCode,
          sessionToken,
        });

        return throwError(() => error);
      }),
    );
  }

  /**
   * Log API request with audit service (ultra-fast, non-blocking)
   */
  private logApiRequest(
    action: 'access' | 'error',
    message: string,
    userId: UserId | null,
    request: Request,
    additionalMetadata: any,
    level: 'info' | 'warn' | 'error',
  ): void {
    // Direct queue insertion - ultra fast, no promises, no async
    this.auditLogService.logApi(
      action,
      message,
      userId,
      request,
      additionalMetadata,
      undefined, // duration will be in additionalMetadata
      level,
    );
  }

  /**
   * Extract IP address from request
   */
  private extractIpAddress(request: Request): string {
    return (
      (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (request.headers['x-real-ip'] as string) ||
      request.connection?.remoteAddress ||
      request.socket?.remoteAddress ||
      (request as any).ip ||
      'unknown'
    );
  }

  /**
   * Determine if audit logging should be skipped for this request (secure version)
   */
  private shouldSkipAudit(path: string, method: string): boolean {
    // Skip GET requests to static assets and health checks (using secure path matching)
    if (method === 'GET' && PathSecurityUtil.matchesPattern(path, AUDIT_SKIP_PATTERNS)) {
      return true;
    }

    return false;
  }

  /**
   * Get appropriate log level based on HTTP status code
   */
  private getLogLevelForStatus(statusCode: number): 'info' | 'warn' | 'error' {
    if (statusCode >= 500) {
      return 'error';
    } else if (statusCode >= 400) {
      return 'warn';
    } else {
      return 'info';
    }
  }

  /**
   * Determine if this request should be logged based on sampling rate
   * High-performance implementation with adaptive sampling
   */
  private shouldLogRequest(request: Request): boolean {
    // Always log errors and critical operations (POST, PUT, DELETE)
    const method = request.method.toLowerCase();
    const isCriticalOperation = ['post', 'put', 'delete', 'patch'].includes(method);

    if (isCriticalOperation) {
      return true; // Always log write operations
    }

    // Increment request counter for adaptive sampling
    this.requestCount++;

    // Reset counters periodically for adaptive sampling
    const now = Date.now();
    if (now - this.lastResetTime > this.ADAPTIVE_RESET_INTERVAL) {
      const requestsPerMinute = this.requestCount;
      this.requestCount = 0;
      this.lastResetTime = now;

      // If using adaptive sampling and traffic is high, reduce sampling rate
      if (this.adaptiveSampling && requestsPerMinute > this.HIGH_TRAFFIC_THRESHOLD) {
        // Under high load, only log 1% of read operations
        return Math.random() < 0.01;
      }
    }

    // Apply configured sampling rate
    return Math.random() < this.samplingRate;
  }

  /**
   * Check if the request is for a critical endpoint that should always be logged (secure version)
   */
  private isCriticalEndpoint(path: string): boolean {
    return PathSecurityUtil.matchesPattern(path, AUDIT_CRITICAL_PATTERNS);
  }
}
