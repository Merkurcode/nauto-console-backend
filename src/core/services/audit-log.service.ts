/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable, Inject } from '@nestjs/common';
import {
  AuditLog,
  AuditLogLevel,
  AuditLogAction,
  IAuditLogMetadata,
} from '@core/entities/audit-log.entity';
import {
  IAuditLogRepository,
  IAuditLogQuery,
  IAuditLogQueryResult,
} from '@core/repositories/audit-log.repository.interface';
import { IUserRepository } from '@core/repositories/user.repository.interface';
import { UserId } from '@core/value-objects/user-id.vo';
import { AUDIT_LOG_REPOSITORY, LOGGER_SERVICE, USER_REPOSITORY } from '@shared/constants/tokens';
import { ILogger } from '@core/interfaces/logger.interface';
import { Request } from 'express';

/**
 * Interface para logging de actividades BOT
 */
export interface IBotActivityLogData {
  userId: string;
  companyId: string | null;
  action: string;
  resource: string;
  details: Record<string, any>;
  ipAddress: string;
  userAgent: string;
}

/**
 * Servicio de dominio para auditoría integral del sistema
 *
 * **Propósito**: Servicio principal que encapsula todas las reglas de negocio
 * relacionadas con el registro de auditoría, proporcionando una API unificada
 * para logging de eventos, consultas y mantenimiento del audit trail.
 *
 * **Responsabilidades**:
 * - Coordina el logging de eventos de diferentes tipos (auth, security, API, etc.)
 * - Gestiona políticas de retención y limpieza de logs
 * - Proporciona APIs de consulta y análisis de logs
 * - Implementa sanitización automática de datos sensibles
 * - Garantiza alta performance mediante queue asíncrono
 * - Mantiene integridad del audit trail ante fallos
 *
 * **Arquitectura**: Servicio de dominio siguiendo DDD
 * - Reside en la capa de dominio (core)
 * - Orquesta múltiples servicios especializados
 * - Usa repository pattern para persistencia
 * - Delega procesamiento asíncrono a AuditLogQueueService
 * - Implementa políticas de negocio (retención, sanitización)
 *
 * **Características de performance**:
 * - Logging asíncrono no-bloqueante para eventos críticos
 * - Queue interno para alta concurrencia
 * - Fallback graceful ante errores de persistencia
 * - Sanitización eficiente de datos sensibles
 *
 * **Integración con sistema**:
 * - Usado por interceptors para logging automático
 * - Integrado con authentication flow para eventos de auth
 * - Conectado con exception filters para error tracking
 * - Soporta análisis y monitoreo via queries
 *
 * @example
 * ```typescript
 * // Logging de autenticación (asíncrono)
 * this.auditService.logAuth('login', 'User login successful', userId, request);
 *
 * // Logging de seguridad (asíncrono)
 * this.auditService.logSecurity('access', 'Unauthorized access attempt', null, request, {}, 'error');
 *
 * // Logging de transacciones (síncrono)
 * await this.auditService.logTransaction('create', 'User created', userId, txId, metadata);
 *
 * // Consulta de logs
 * const logs = await this.auditService.queryLogs({
 *   type: 'auth',
 *   fromDate: yesterday,
 *   toDate: now,
 *   limit: 100
 * });
 *
 * // Limpieza automática (política de 7 días)
 * await this.auditService.performAutomaticCleanup();
 * ```
 *
 * **Políticas implementadas**:
 * - Retención automática de 7 días
 * - Sanitización de campos sensibles (password, token, etc.)
 * - Non-blocking para operaciones críticas
 * - Fallback logging ante errores de persistencia
 */
@Injectable()
export class AuditLogService {
  constructor(
    @Inject(AUDIT_LOG_REPOSITORY)
    private readonly auditLogRepository: IAuditLogRepository,
    @Inject(LOGGER_SERVICE)
    private readonly logger: ILogger,
    @Inject(USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
  ) {
    this.logger.setContext(AuditLogService.name);
  }

  /**
   * Registra eventos de autenticación con alta performance
   *
   * **Propósito**: Método no-bloqueante para registrar todos los eventos
   * relacionados con autenticación (login, logout, registro, etc.)
   *
   * **Características**:
   * - Procesamiento asíncrono via queue
   * - No bloquea operaciones críticas
   * - Extracción automática de contexto HTTP
   * - Sanitización de datos sensibles
   *
   * @param action - Acción específica (login, logout, register, etc.)
   * @param message - Mensaje descriptivo del evento
   * @param userId - Usuario asociado (null para intentos fallidos)
   * @param request - Request HTTP para contexto adicional
   * @param additionalMetadata - Metadata específica del evento
   * @param level - Nivel de severidad ('info' por defecto)
   */
  async logAuth(
    action: AuditLogAction,
    message: string,
    userId: UserId | null,
    request?: Request,
    additionalMetadata?: Partial<IAuditLogMetadata>,
    level: AuditLogLevel = 'info',
  ): Promise<void> {
    const metadata = this.buildRequestMetadata(request, additionalMetadata);
    // Queue service was removed - using direct repository call
    await this.saveAuditLog(AuditLog.createAuthLog(action, message, userId, metadata, level));
  }

  /**
   * Registra eventos de seguridad con alta performance
   *
   * **Propósito**: Método no-bloqueante para registrar eventos críticos
   * de seguridad que requieren monitoreo y análisis inmediato.
   *
   * **Casos de uso**:
   * - Intentos de acceso no autorizado
   * - Violaciones de permisos
   * - Ataques detectados
   * - Anomalías en patrones de uso
   *
   * @param action - Tipo de evento de seguridad
   * @param message - Descripción detallada del evento
   * @param userId - Usuario involucrado (null para ataques anónimos)
   * @param request - Request HTTP para análisis de ataque
   * @param additionalMetadata - Contexto adicional de seguridad
   * @param level - Nivel de severidad ('warn' por defecto)
   */
  async logSecurity(
    action: AuditLogAction,
    message: string,
    userId: UserId | null,
    request?: Request,
    additionalMetadata?: Partial<IAuditLogMetadata>,
    level: AuditLogLevel = 'warn',
  ): Promise<void> {
    const metadata = this.buildRequestMetadata(request, additionalMetadata);
    // Queue service was removed - using direct repository call
    await this.saveAuditLog(AuditLog.createSecurityLog(action, message, userId, metadata, level));
  }

  /**
   * Registra excepciones y errores del sistema
   *
   * **Propósito**: Captura automáticamente información detallada de errores
   * para facilitar debugging y monitoreo de estabilidad del sistema.
   *
   * **Información capturada automáticamente**:
   * - Mensaje de error
   * - Stack trace completo
   * - Código de error (si disponible)
   * - Tipo de excepción
   * - Contexto de usuario y request
   *
   * @param error - Instancia de Error a registrar
   * @param userId - Usuario asociado al contexto del error
   * @param request - Request HTTP donde ocurrió el error
   * @param additionalMetadata - Contexto adicional específico
   */
  async logException(
    error: Error,
    userId: UserId | null,
    request?: Request,
    additionalMetadata?: Partial<IAuditLogMetadata>,
    level: AuditLogLevel = 'error',
  ): Promise<void> {
    const metadata = this.buildRequestMetadata(request, {
      errorMessage: error.message,
      errorStack: error.stack,
      errorCode: (error as any).code,
      exceptionType: error.constructor.name,
      ...additionalMetadata,
    });
    // Queue service was removed - using direct repository call
    await this.saveAuditLog(AuditLog.createExceptionLog(error.message, userId, metadata, level));
  }

  /**
   * Log API requests and responses (high performance, non-blocking)
   */
  async logApi(
    action: AuditLogAction,
    message: string,
    userId: UserId | null,
    request?: Request,
    responseData?: unknown,
    duration?: number,
    level: AuditLogLevel = 'info',
  ): Promise<void> {
    const metadata = this.buildRequestMetadata(request, {
      duration,
      responseStatus: (responseData as any)?.statusCode,
      responseSize: responseData ? JSON.stringify(responseData).length : undefined,
    });
    // Queue service was removed - using direct repository call
    await this.saveAuditLog(AuditLog.createApiLog(action, message, userId, metadata, level));
  }

  /**
   * Log transaction events
   */
  async logTransaction(
    action: AuditLogAction,
    message: string,
    userId: UserId | null,
    transactionId?: string,
    additionalMetadata?: Partial<IAuditLogMetadata>,
    level: AuditLogLevel = 'info',
  ): Promise<void> {
    const metadata: IAuditLogMetadata = {
      transactionId,
      ...additionalMetadata,
    };
    // Queue service was removed - using direct repository call
    await this.saveAuditLog(
      AuditLog.createTransactionLog(action, message, userId, metadata, level),
    );
  }

  /**
   * Log user actions (CRUD operations)
   */
  async logUserAction(
    action: AuditLogAction,
    message: string,
    userId: UserId,
    resource: string,
    resourceId?: string,
    previousValue?: unknown,
    newValue?: unknown,
    request?: Request,
  ): Promise<void> {
    const metadata = this.buildRequestMetadata(request, {
      resource,
      resourceId,
      previousValue,
      newValue,
    });
    const auditLog = AuditLog.create('info', 'user', action, message, userId, metadata, 'user');
    // Queue service was removed - using direct repository call
    await this.saveAuditLog(auditLog);
  }

  /**
   * Query audit logs with filters
   */
  async queryLogs(query: IAuditLogQuery): Promise<IAuditLogQueryResult> {
    return this.auditLogRepository.query(query);
  }

  /**
   * Get recent error logs for monitoring
   */
  async getRecentErrors(hours: number = 24, limit: number = 100): Promise<AuditLog[]> {
    return this.auditLogRepository.findRecentErrors(hours, limit);
  }

  /**
   * Get security logs for a date range
   */
  async getSecurityLogs(fromDate: Date, toDate: Date, limit: number = 1000): Promise<AuditLog[]> {
    return this.auditLogRepository.findSecurityLogs(fromDate, toDate, limit);
  }

  /**
   * Get audit statistics
   */
  async getStatistics(fromDate: Date, toDate: Date) {
    return this.auditLogRepository.getStatistics(fromDate, toDate);
  }

  /**
   * Cleanup old audit logs (retention policy)
   * Default: 7-day retention as requested
   */
  async cleanupOldLogs(retentionDays: number = 7): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const deletedCount = await this.auditLogRepository.deleteOlderThan(cutoffDate);

    this.logger.log({
      message: 'Audit log cleanup completed',
      deletedCount,
      retentionDays,
      cutoffDate: cutoffDate.toISOString(),
    });

    return deletedCount;
  }

  /**
   * Perform automatic 7-day cleanup (as requested)
   * This method enforces the 7-day retention policy
   */
  async performAutomaticCleanup(): Promise<number> {
    return this.cleanupOldLogs(7);
  }

  /**
   * Consulta específica para logs de actividad BOT
   *
   * @param filters - Filtros específicos para BOT
   * @param limit - Límite de resultados (default: 100)
   * @returns Logs de actividad BOT
   */
  async queryBotActivity(
    filters: {
      botAlias?: string;
      companyId?: string;
      tokenId?: string;
      fromDate?: Date;
      toDate?: Date;
      method?: string;
      path?: string;
      statusCode?: number;
    },
    limit: number = 100,
  ): Promise<AuditLog[]> {
    let userId: string | undefined;

    // If botAlias is provided, find the user with that alias to get their userId
    if (filters.botAlias) {
      try {
        const user = await this.userRepository.findByAlias(filters.botAlias);
        userId = user?.id.getValue();

        if (!userId) {
          // If no user found with this alias, return empty results
          this.logger.debug({
            message: 'No user found with provided alias for bot audit query',
            alias: filters.botAlias,
          });

          return [];
        }
      } catch (error) {
        this.logger.warn({
          message: 'Error finding user by alias in bot audit query',
          alias: filters.botAlias,
          error: error.message,
        });

        return [];
      }
    }

    const query: IAuditLogQuery = {
      filters: {
        type: ['bot'],
        userId,
        fromDate: filters.fromDate,
        toDate: filters.toDate,
        // Additional filters as search text
        search:
          [
            filters.companyId && `companyId:${filters.companyId}`,
            filters.tokenId && `tokenId:${filters.tokenId}`,
            filters.method && `method:${filters.method}`,
            filters.path && `path:${filters.path}`,
            filters.statusCode && `statusCode:${filters.statusCode}`,
          ]
            .filter(Boolean)
            .join(' ') || undefined,
      },
      limit,
    };

    const result = await this.queryLogs(query);

    return result.logs;
  }

  /**
   * Log BOT activity with automatic alias resolution
   */
  async logBotActivity(botData: IBotActivityLogData): Promise<void> {
    try {
      // Get user to resolve alias
      const user = await this.userRepository.findById(botData.userId);
      const botAlias = user?.alias;

      const auditLog = AuditLog.create(
        'info',
        'bot',
        botData.action as AuditLogAction,
        `BOT Activity: ${botData.action}`,
        UserId.fromString(botData.userId),
        {
          ...botData.details,
          botAlias,
          companyId: botData.companyId,
          resource: botData.resource,
          ipAddress: botData.ipAddress,
          userAgent: botData.userAgent,
        },
        'bot',
      );
      // Queue service was removed - using direct repository call
      await this.saveAuditLog(auditLog);

      this.logger.debug({
        message: 'BOT activity queued for audit logging',
        userId: botData.userId,
        action: botData.action,
        resource: botData.resource,
        botAlias,
      });
    } catch (error) {
      this.logger.error({
        message: 'Failed to queue BOT activity audit log',
        error: error.message,
        userId: botData.userId,
        action: botData.action,
        resource: botData.resource,
      });

      // Fallback: log critical information synchronously
      this.logger.warn({
        message: 'BOT activity audit logging failed',
        userId: botData.userId,
        action: botData.action,
        resource: botData.resource,
        fallbackLogged: true,
      });

      // No lanzar error para no bloquear operaciones del BOT
      // El BOT debe seguir funcionando aunque falle el logging
    }
  }

  /**
   * Build metadata from HTTP request
   */
  private buildRequestMetadata(
    request?: Request,
    additionalMetadata?: Partial<IAuditLogMetadata>,
  ): IAuditLogMetadata {
    const baseMetadata: IAuditLogMetadata = {
      application: String(request ? (request.headers?.['x-application'] ?? 'unknown') : 'unknown'),
      timestamp: new Date().toISOString(),
      ...additionalMetadata,
    };

    if (!request) {
      return baseMetadata;
    }

    // Extract request information
    const requestMetadata: IAuditLogMetadata = {
      ...baseMetadata,
      method: request.method,
      url: request.url,
      userAgent: request.headers['user-agent'],
      ipAddress: this.extractIpAddress(request),
      headers: this.sanitizeHeaders(request.headers),
      query: request.query,
      params: request.params,
      body: this.sanitizeBody(request.body) as Record<string, unknown>,
    };

    // Extract user/session information if available
    if (request.user) {
      requestMetadata.sessionUser = (request.user as any).id;
      requestMetadata.sessionToken = (request as any).sessionToken;
    }

    // Extract session information from headers or custom properties
    if (request.headers['x-session-id']) {
      requestMetadata.sessionId = request.headers['x-session-id'] as string;
    }

    return requestMetadata;
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
   * Sanitize headers to remove sensitive information
   */
  private sanitizeHeaders(headers: Record<string, unknown>): Record<string, string> {
    const sanitized: Record<string, string> = {};
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'x-auth-token'];

    Object.keys(headers).forEach(key => {
      if (sensitiveHeaders.includes(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = String(headers[key]);
      }
    });

    return sanitized;
  }

  /**
   * Sanitize request body to remove sensitive information
   */
  private sanitizeBody(body: unknown): unknown {
    if (!body || typeof body !== 'object') {
      return body;
    }

    const sanitized = { ...body };
    const sensitiveFields = ['password', 'passwordHash', 'token', 'secret', 'key', 'otp'];

    Object.keys(sanitized).forEach(key => {
      if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
        sanitized[key] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  /**
   * Save audit log with error handling
   */
  private async saveAuditLog(auditLog: AuditLog): Promise<void> {
    try {
      await this.auditLogRepository.save(auditLog);

      // Also log to application logger for immediate visibility
      this.logger.log({
        message: 'Audit log created',
        auditLogId: auditLog.id.getValue(),
        level: auditLog.level,
        type: auditLog.type,
        action: auditLog.action,
        context: auditLog.context,
        userId: auditLog.userId?.getValue(),
        auditMessage: auditLog.message,
      });
    } catch (error) {
      // Critical: audit logging should not fail the main operation
      // Log the failure but don't throw
      this.logger.error({
        message: 'Failed to save audit log',
        error: error instanceof Error ? error.message : String(error),
        auditLogData: {
          level: auditLog.level,
          type: auditLog.type,
          action: auditLog.action,
          message: auditLog.message,
        },
      });
    }
  }

  /**
   * Log company deactivation event
   */
  async logCompanyDeactivation(
    adminUserId: string,
    companyId: string,
    companyName: string,
    metadata: Record<string, any>,
  ): Promise<void> {
    const userId = adminUserId ? UserId.fromString(adminUserId) : null;
    const auditLog = AuditLog.create(
      'info',
      'company',
      'update',
      `Company "${companyName}" (${companyId}) deactivated by administrator`,
      userId,
      {
        ...metadata,
        eventType: 'company_deactivation',
        severity: 'high',
        category: 'administrative_action',
      },
      'company',
    );
    await this.saveAuditLog(auditLog);
  }

  /**
   * Log user ban event
   */
  async logUserBan(
    adminUserId: string,
    targetUserId: string,
    metadata: Record<string, any>,
  ): Promise<void> {
    const userId = adminUserId ? UserId.fromString(adminUserId) : null;
    const auditLog = AuditLog.create(
      'info',
      'user',
      'update',
      `User banned - ID: ${targetUserId}, Reason: ${metadata.banReason}`,
      userId,
      {
        ...metadata,
        eventType: 'user_ban',
        severity: 'high',
        category: 'security_action',
      },
      'user',
    );
    await this.saveAuditLog(auditLog);
  }

  /**
   * Log user unban event
   */
  async logUserUnban(
    adminUserId: string,
    targetUserId: string,
    metadata: Record<string, any>,
  ): Promise<void> {
    const userId = adminUserId ? UserId.fromString(adminUserId) : null;
    const auditLog = AuditLog.create(
      'info',
      'user',
      'update',
      `User unbanned - ID: ${targetUserId}`,
      userId,
      {
        ...metadata,
        eventType: 'user_unban',
        severity: 'medium',
        category: 'security_action',
      },
      'user',
    );
    await this.saveAuditLog(auditLog);
  }

  /**
   * Log system errors
   */
  async logSystemError(
    userId: string | null,
    action: string,
    message: string,
    metadata: Record<string, any>,
  ): Promise<void> {
    const userIdVO = userId ? UserId.fromString(userId) : null;
    const auditLog = AuditLog.create(
      'error',
      'system',
      'read',
      message,
      userIdVO,
      {
        ...metadata,
        eventType: 'system_error',
        severity: 'high',
        category: 'error',
      },
      'system',
    );
    await this.saveAuditLog(auditLog);
  }
}
