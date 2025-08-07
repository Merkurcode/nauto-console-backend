import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Inject } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request, Response } from 'express';
import { AuditLogService } from '@core/services/audit-log.service';
import { UserId } from '@core/value-objects/user-id.vo';
import { AUDIT_LOG_SERVICE } from '@shared/constants/tokens';

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
  constructor(
    @Inject(AUDIT_LOG_SERVICE)
    private readonly auditLogService: AuditLogService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const startTime = Date.now();
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    // Extract request information
    const { method, url } = request;

    // Extract user information if available
    const user = (request as any).user;
    const userId = user?.id ? UserId.fromString(user.id) : null;
    const sessionToken = (request as any).sessionToken;

    // Skip audit logging for health checks and non-essential endpoints
    if (this.shouldSkipAudit(url, method)) {
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
   * Determine if audit logging should be skipped for this request
   */
  private shouldSkipAudit(url: string, method: string): boolean {
    const skipPatterns = [
      '/health',
      '/metrics',
      '/favicon.ico',
      '/robots.txt',
      '/.well-known',
      '/api/health',
      '/api/metrics',
    ];

    // Skip GET requests to static assets and health checks
    if (method === 'GET' && skipPatterns.some(pattern => url.includes(pattern))) {
      return true;
    }

    // Skip swagger documentation requests
    if (url.includes('/docs') || url.includes('/api-json')) {
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
}
