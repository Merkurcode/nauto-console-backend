import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Inject } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request, Response } from 'express';
import { ILogger } from '@core/interfaces/logger.interface';
import { LOGGER_SERVICE } from '@shared/constants/tokens';
import { BOT_SPECIAL_PERMISSIONS } from '@shared/constants/bot-permissions';
import { IJwtPayload } from '@application/dtos/responses/user.response';
import { AuditLogService } from '@core/services/audit-log.service';

/**
 * Interceptor de Auditoría para BOT
 *
 * Registra TODOS los accesos del BOT en:
 * - Logs de archivos (para debugging inmediato)
 * - Base de datos (para consultas y reportes)
 *
 * Incluye:
 * - Método HTTP y endpoint
 * - Headers relevantes
 * - Body/payload de requests
 * - Respuestas (tamaño y status)
 * - Timing de operaciones
 * - IP y User-Agent
 * - Parámetros de query y ruta
 */
@Injectable()
export class BotAuditInterceptor implements NestInterceptor {
  constructor(
    @Inject(LOGGER_SERVICE)
    private readonly logger: ILogger,
    private readonly auditLogService: AuditLogService,
  ) {
    this.logger.setContext(BotAuditInterceptor.name);
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const user = request.user as IJwtPayload;

    // Solo auditar si es un token BOT
    const isBotToken = user?.permissions?.includes(BOT_SPECIAL_PERMISSIONS.ALL_ACCESS);

    if (!isBotToken) {
      return next.handle();
    }

    const startTime = Date.now();
    const requestId = this.generateRequestId();

    // Log de inicio de request BOT
    this.logBotRequestStart(request, user, requestId, startTime);

    return next.handle().pipe(
      tap(async responseData => {
        // Log de request exitoso
        await this.logBotRequestSuccess(
          request,
          response,
          responseData,
          user,
          requestId,
          startTime,
        );
      }),
      catchError(async error => {
        // Log de request con error
        await this.logBotRequestError(request, response, error, user, requestId, startTime);
        throw error;
      }),
    );
  }

  private async logBotRequestStart(
    request: Request,
    user: IJwtPayload,
    requestId: string,
    startTime: number,
  ): Promise<void> {
    const auditData = {
      event: 'BOT_REQUEST_START',
      requestId,
      timestamp: new Date(startTime).toISOString(),

      // Información del BOT
      botInfo: {
        userId: user.sub,
        email: user.email,
        tokenId: user.jti || 'no-jti',
        companyId: user.companyId,
        tenantId: user.tenantId,
      },

      // Información de la request
      request: {
        method: request.method,
        url: request.url,
        path: request.path,
        originalUrl: request.originalUrl,

        // Parámetros
        query: this.sanitizeObject(request.query),
        params: this.sanitizeObject(request.params),

        // Headers relevantes (sin Authorization)
        headers: this.sanitizeHeaders(request.headers),

        // Body/payload (sanitizado)
        body: this.sanitizeRequestBody(request.body, request.method),

        // Información de red
        ip: this.getClientIP(request),
        userAgent: request.headers['user-agent'] || 'unknown',

        // Tamaño de contenido
        contentLength: request.headers['content-length'] || '0',
        contentType: request.headers['content-type'] || 'unknown',
      },

      // Contexto técnico
      technical: {
        nodeEnv: process.env.NODE_ENV,
        requestStartTime: startTime,
      },
    };

    // Log en archivos
    this.logger.warn(auditData);

    // Guardar en base de datos
    try {
      await this.auditLogService.logBotActivity({
        userId: user.sub,
        companyId: user.companyId || null,
        action: 'BOT_REQUEST_START',
        resource: `${request.method} ${request.path}`,
        details: {
          requestId,
          method: request.method,
          path: request.path,
          query: this.sanitizeObject(request.query),
          params: this.sanitizeObject(request.params),
          body: this.sanitizeRequestBody(request.body, request.method),
          ip: this.getClientIP(request),
          userAgent: request.headers['user-agent'] || 'unknown',
          tokenId: user.jti,
          timestamp: new Date(startTime).toISOString(),
        },
        ipAddress: this.getClientIP(request),
        userAgent: request.headers['user-agent'] || 'unknown',
      });
    } catch (error) {
      this.logger.error({
        message: 'Failed to save BOT audit log to database',
        error: error.message,
        requestId,
      });
    }
  }

  private async logBotRequestSuccess(
    request: Request,
    response: Response,
    responseData: any,
    user: IJwtPayload,
    requestId: string,
    startTime: number,
  ): Promise<void> {
    const endTime = Date.now();
    const duration = endTime - startTime;

    const auditData = {
      event: 'BOT_REQUEST_SUCCESS',
      requestId,
      timestamp: new Date(endTime).toISOString(),

      // Información del BOT
      botInfo: {
        userId: user.sub,
        email: user.email,
        tokenId: user.jti || 'no-jti',
      },

      // Información de request/response
      request: {
        method: request.method,
        path: request.path,
        query: this.sanitizeObject(request.query),
        params: this.sanitizeObject(request.params),
      },

      response: {
        statusCode: response.statusCode,
        statusMessage: response.statusMessage,

        // Tamaño de respuesta
        contentLength: response.getHeader('content-length') || 'unknown',

        // Headers de respuesta relevantes
        headers: this.sanitizeResponseHeaders(response.getHeaders()),

        // Datos de respuesta (limitados por tamaño)
        data: this.sanitizeResponseData(responseData),
      },

      // Métricas de rendimiento
      performance: {
        duration: `${duration}ms`,
        startTime,
        endTime,
      },
    };

    // Log en archivos
    this.logger.warn(auditData);

    // Guardar en base de datos
    try {
      await this.auditLogService.logBotActivity({
        userId: user.sub,
        companyId: user.companyId || null,
        action: 'BOT_REQUEST_SUCCESS',
        resource: `${request.method} ${request.path}`,
        details: {
          requestId,
          method: request.method,
          path: request.path,
          statusCode: response.statusCode,
          duration: `${duration}ms`,
          responseSize: response.getHeader('content-length') || 'unknown',
          query: this.sanitizeObject(request.query),
          params: this.sanitizeObject(request.params),
          tokenId: user.jti,
          timestamp: new Date(endTime).toISOString(),
        },
        ipAddress: this.getClientIP(request),
        userAgent: request.headers['user-agent'] || 'unknown',
      });
    } catch (error) {
      this.logger.error({
        message: 'Failed to save BOT success audit log to database',
        error: error.message,
        requestId,
      });
    }
  }

  private async logBotRequestError(
    request: Request,
    response: Response,
    error: any,
    user: IJwtPayload,
    requestId: string,
    startTime: number,
  ): Promise<void> {
    const endTime = Date.now();
    const duration = endTime - startTime;

    const auditData = {
      event: 'BOT_REQUEST_ERROR',
      requestId,
      timestamp: new Date(endTime).toISOString(),

      // Información del BOT
      botInfo: {
        userId: user.sub,
        email: user.email,
        tokenId: user.jti || 'no-jti',
      },

      // Información de request
      request: {
        method: request.method,
        path: request.path,
        query: this.sanitizeObject(request.query),
        params: this.sanitizeObject(request.params),
        body: this.sanitizeRequestBody(request.body, request.method),
      },

      // Información del error
      error: {
        name: error.name || 'UnknownError',
        message: error.message || 'Unknown error occurred',
        statusCode: error.status || response.statusCode || 500,
        code: error.code || 'UNKNOWN_ERROR',

        // Stack trace solo en desarrollo
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },

      // Métricas
      performance: {
        duration: `${duration}ms`,
        startTime,
        endTime,
      },
    };

    // Log en archivos
    this.logger.error(auditData);

    // Guardar en base de datos
    try {
      await this.auditLogService.logBotActivity({
        userId: user.sub,
        companyId: user.companyId || null,
        action: 'BOT_REQUEST_ERROR',
        resource: `${request.method} ${request.path}`,
        details: {
          requestId,
          method: request.method,
          path: request.path,
          error: {
            name: error.name || 'UnknownError',
            message: error.message || 'Unknown error occurred',
            statusCode: error.status || response.statusCode || 500,
            code: error.code || 'UNKNOWN_ERROR',
          },
          duration: `${duration}ms`,
          query: this.sanitizeObject(request.query),
          params: this.sanitizeObject(request.params),
          body: this.sanitizeRequestBody(request.body, request.method),
          tokenId: user.jti,
          timestamp: new Date(endTime).toISOString(),
        },
        ipAddress: this.getClientIP(request),
        userAgent: request.headers['user-agent'] || 'unknown',
      });
    } catch (dbError) {
      this.logger.error({
        message: 'Failed to save BOT error audit log to database',
        error: dbError.message,
        requestId,
        originalError: error.message,
      });
    }
  }

  private sanitizeRequestBody(body: any, method: string): any {
    if (!body || method === 'GET' || method === 'DELETE') {
      return undefined;
    }

    // Limitar tamaño del body en logs
    const bodyStr = JSON.stringify(body);
    if (bodyStr.length > 2000) {
      return {
        _truncated: true,
        _originalSize: bodyStr.length,
        _preview: bodyStr.substring(0, 500) + '...[TRUNCATED]',
      };
    }

    // Sanitizar campos sensibles
    return this.sanitizeObject(body);
  }

  private sanitizeResponseData(data: any): any {
    if (!data) {
      return undefined;
    }

    // Limitar tamaño de respuesta en logs
    const dataStr = JSON.stringify(data);
    if (dataStr.length > 1000) {
      return {
        _truncated: true,
        _originalSize: dataStr.length,
        _type: Array.isArray(data) ? 'array' : typeof data,
        _itemCount: Array.isArray(data) ? data.length : undefined,
      };
    }

    return this.sanitizeObject(data);
  }

  private sanitizeHeaders(headers: any): Record<string, string> {
    const sanitized: Record<string, string> = {};

    // Headers relevantes para auditoría
    const relevantHeaders = [
      'content-type',
      'content-length',
      'user-agent',
      'accept',
      'x-forwarded-for',
      'x-real-ip',
      'origin',
      'referer',
      'x-request-id',
      'x-correlation-id',
    ];

    relevantHeaders.forEach(header => {
      if (headers[header]) {
        sanitized[header] = String(headers[header]);
      }
    });

    // Nunca incluir Authorization header
    return sanitized;
  }

  private sanitizeResponseHeaders(headers: any): Record<string, any> {
    const sanitized: Record<string, any> = {};

    const relevantHeaders = [
      'content-type',
      'content-length',
      'x-ratelimit-limit',
      'x-ratelimit-remaining',
      'cache-control',
    ];

    relevantHeaders.forEach(header => {
      if (headers[header]) {
        sanitized[header] = headers[header];
      }
    });

    return sanitized;
  }

  private sanitizeObject(obj: any): any {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    // Campos sensibles a ocultar
    const sensitiveFields = [
      'password',
      'token',
      'secret',
      'key',
      'auth',
      'authorization',
      'creditcard',
      'ssn',
      'pin',
    ];

    const sanitized = { ...obj };

    for (const key in sanitized) {
      const keyLower = key.toLowerCase();

      // Ocultar campos sensibles
      if (sensitiveFields.some(field => keyLower.includes(field))) {
        sanitized[key] = '[REDACTED]';
      }

      // Recursivamente sanitizar objetos anidados
      if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = this.sanitizeObject(sanitized[key]);
      }
    }

    return sanitized;
  }

  private getClientIP(request: Request): string {
    return (
      (request.headers['x-forwarded-for'] as string) ||
      (request.headers['x-real-ip'] as string) ||
      request.connection?.remoteAddress ||
      request.socket?.remoteAddress ||
      'unknown'
    );
  }

  private generateRequestId(): string {
    return `bot_req_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
  }
}
