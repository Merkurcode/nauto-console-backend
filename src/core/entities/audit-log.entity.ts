import { UserId } from '@core/value-objects/user-id.vo';
import { AuditLogId } from '@core/value-objects/audit-log-id.vo';
import { AggregateRoot } from '@core/events/domain-event.base';

/**
 * Niveles de severidad para logs de auditoría
 *
 * **Propósito**: Categoriza la importancia y severidad de los eventos registrados
 * para facilitar filtrado, alertas y análisis de seguridad.
 *
 * @example
 * ```typescript
 * // Login exitoso - información general
 * AuditLog.create('info', 'auth', 'login', 'User logged in')
 *
 * // Intento de login fallido - advertencia
 * AuditLog.create('warn', 'security', 'login', 'Failed login attempt')
 *
 * // Error crítico del sistema - error crítico
 * AuditLog.create('critical', 'system', 'error', 'Database connection lost')
 * ```
 */
export type AuditLogLevel = 'info' | 'warn' | 'error' | 'debug' | 'critical';

/**
 * Tipos de eventos que pueden ser registrados en auditoría
 *
 * **Propósito**: Categoriza los eventos por área funcional para facilitar
 * análisis, reportes y compliance con regulaciones de seguridad.
 *
 * **Categorías**:
 * - **auth**: Eventos de autenticación y autorización
 * - **user**: Operaciones CRUD de usuarios
 * - **role/permission**: Cambios en control de acceso
 * - **company**: Operaciones a nivel empresa (multi-tenancy)
 * - **system**: Eventos internos del sistema
 * - **api**: Llamadas API y respuestas
 * - **database**: Operaciones de base de datos
 * - **security**: Eventos relacionados con seguridad
 * - **exception**: Errores y excepciones
 * - **transaction**: Transacciones de base de datos
 */
export type AuditLogType =
  | 'auth'
  | 'user'
  | 'role'
  | 'permission'
  | 'company'
  | 'system'
  | 'api'
  | 'database'
  | 'security'
  | 'exception'
  | 'transaction'
  | 'bot';

/**
 * Acciones específicas que pueden ser auditadas
 *
 * **Propósito**: Especifica la acción concreta realizada, complementando
 * el tipo de evento para proporcionar contexto granular.
 *
 * **Categorías**:
 * - **CRUD**: create, read, update, delete
 * - **Auth**: login, logout, register, verify, reset
 * - **Authorization**: assign, revoke, access
 * - **System**: error, exception
 * - **Transactions**: transaction_start, transaction_commit, transaction_rollback
 */
export type AuditLogAction =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'login'
  | 'logout'
  | 'register'
  | 'verify'
  | 'reset'
  | 'assign'
  | 'revoke'
  | 'access'
  | 'error'
  | 'exception'
  | 'transaction_start'
  | 'transaction_commit'
  | 'transaction_rollback';

/**
 * Metadata estructurada para logs de auditoría
 *
 * **Propósito**: Proporciona contexto detallado para cada evento auditado,
 * incluyendo información técnica, de usuario y de aplicación necesaria
 * para debugging, análisis de seguridad y compliance.
 *
 * **Categorías de información**:
 * - **Request**: Detalles de la petición HTTP
 * - **User/Session**: Información del usuario y sesión
 * - **Application**: Contexto de la aplicación
 * - **Error**: Información de errores y excepciones
 * - **Performance**: Métricas de rendimiento
 * - **Business**: Contexto de negocio y datos
 *
 * @example
 * ```typescript
 * const metadata: IAuditLogMetadata = {
 *   // Request info
 *   method: 'POST',
 *   url: '/api/auth/login',
 *   statusCode: 401,
 *
 *   // User context
 *   userAgent: 'Mozilla/5.0...',
 *   ipAddress: '192.168.1.100',
 *
 *   // Error context
 *   errorMessage: 'Invalid password',
 *   duration: 150
 * };
 * ```
 */
export interface IAuditLogMetadata {
  // Request information
  /** Método HTTP (GET, POST, PUT, DELETE) */
  method?: string;
  /** URL de la petición */
  url?: string;
  /** Código de estado HTTP de respuesta */
  statusCode?: number;
  /** Headers HTTP relevantes */
  headers?: Record<string, string>;
  /** Query parameters de la petición */
  query?: Record<string, unknown>;
  /** Path parameters de la petición */
  params?: Record<string, unknown>;
  /** Body de la petición (sanitizado) */
  body?: Record<string, unknown>;

  // User/Session information
  /** User agent del cliente */
  userAgent?: string;
  /** Dirección IP del cliente */
  ipAddress?: string;
  /** ID de la sesión activa */
  sessionId?: string;
  /** Token de sesión */
  sessionToken?: string;

  // Application context
  /** Nombre de la aplicación o microservicio */
  application?: string;
  /** Módulo o área funcional */
  module?: string;
  /** Controller que maneja la petición */
  controller?: string;
  /** Handler o método específico */
  handler?: string;

  // Error/Exception information
  /** Mensaje de error legible */
  errorMessage?: string;
  /** Stack trace del error */
  errorStack?: string;
  /** Código de error específico */
  errorCode?: string;
  /** Tipo de excepción */
  exceptionType?: string;

  // Performance information
  /** Duración de la operación en millisegundos */
  duration?: number;

  // Additional context
  /** Recurso afectado (tabla, entidad, etc.) */
  resource?: string;
  /** ID específico del recurso */
  resourceId?: string;
  /** Valor previo (para updates) */
  previousValue?: unknown;
  /** Nuevo valor (para creates/updates) */
  newValue?: unknown;

  // Custom metadata
  /** Campos adicionales específicos del contexto */
  [key: string]: unknown;
}

/**
 * Entidad de dominio AuditLog - Sistema integral de auditoría
 *
 * **Propósito**: Entidad principal para el registro comprehensivo de todos los eventos
 * del sistema, proporcionando trazabilidad completa, análisis de seguridad y compliance.
 *
 * **Responsabilidades**:
 * - Registra todas las actividades de usuarios y sistema
 * - Proporciona contexto detallado para debugging y análisis
 * - Implementa sanitización automática de datos sensibles
 * - Soporta categorización multi-dimensional (level, type, action)
 * - Facilita compliance con regulaciones de auditoría
 *
 * **Arquitectura**: Siguiendo DDD (Domain-Driven Design)
 * - Extend AggregateRoot para soporte de domain events
 * - Inmutable después de creación (audit trail integrity)
 * - Factory methods para diferentes tipos de logs
 * - Value Objects para IDs tipados
 *
 * **Características de seguridad**:
 * - Sanitización automática de información sensible
 * - Detección de contenido sensible
 * - Formateo consistente para análisis
 * - Metadata estructurada y extensible
 *
 * @example
 * ```typescript
 * // Crear log de autenticación exitosa
 * const authLog = AuditLog.createAuthLog(
 *   'login',
 *   'User logged in successfully',
 *   userId,
 *   { ipAddress: '192.168.1.100', duration: 150 }
 * );
 *
 * // Crear log de error de seguridad
 * const securityLog = AuditLog.createSecurityLog(
 *   'access',
 *   'Unauthorized access attempt',
 *   null,
 *   { resource: '/admin/users', method: 'GET' },
 *   'error'
 * );
 *
 * // Verificar sensibilidad y obtener metadata sanitizada
 * if (auditLog.isSensitive()) {
 *   const safeMetadata = auditLog.getSanitizedMetadata();
 * }
 * ```
 *
 * **Integración con sistema**:
 * - Usado por AuditLogService para lógica de negocio
 * - Persistido via AuditLogRepository
 * - Procesado asincrónicamente por AuditLogQueueService
 * - Limpieza automática por AuditLogCleanupService
 */
export class AuditLog extends AggregateRoot {
  private constructor(
    public readonly id: AuditLogId,
    public readonly level: AuditLogLevel,
    public readonly type: AuditLogType,
    public readonly action: AuditLogAction,
    public readonly message: string,
    public readonly userId: UserId | null,
    public readonly metadata: IAuditLogMetadata,
    public readonly timestamp: Date,
    public readonly context: string,
  ) {
    super();
  }

  /**
   * Factory method principal para crear nuevos logs de auditoría
   *
   * **Propósito**: Punto de entrada unificado para crear cualquier tipo de audit log
   * con todos los parámetros requeridos y generación automática de ID y timestamp.
   *
   * @param level - Nivel de severidad del evento
   * @param type - Tipo/categoría del evento
   * @param action - Acción específica realizada
   * @param message - Mensaje descriptivo del evento
   * @param userId - ID del usuario asociado (null para eventos del sistema)
   * @param metadata - Contexto adicional estructurado
   * @param context - Contexto de la aplicación donde ocurrió el evento
   * @returns Nueva instancia de AuditLog inmutable
   */
  static create(
    level: AuditLogLevel,
    type: AuditLogType,
    action: AuditLogAction,
    message: string,
    userId: UserId | null = null,
    metadata: IAuditLogMetadata = {},
    context: string = 'system',
  ): AuditLog {
    const id = AuditLogId.generate();
    const timestamp = new Date();

    return new AuditLog(id, level, type, action, message, userId, metadata, timestamp, context);
  }

  /**
   * Factory method para logs de autenticación
   *
   * **Propósito**: Crea logs específicos para eventos de autenticación
   * con configuración predeterminada optimizada para auth events.
   *
   * **Casos de uso**:
   * - Login exitoso/fallido
   * - Logout
   * - Registro de usuarios
   * - Verificación de email/OTP
   * - Reseteo de password
   *
   * @param action - Acción de auth (login, logout, register, etc.)
   * @param message - Descripción del evento de auth
   * @param userId - Usuario involucrado (null para intentos fallidos sin usuario)
   * @param metadata - Contexto como IP, user agent, duración, etc.
   * @param level - Nivel de severidad ('info' por defecto)
   */
  static createAuthLog(
    action: AuditLogAction,
    message: string,
    userId: UserId | null,
    metadata: IAuditLogMetadata,
    level: AuditLogLevel = 'info',
  ): AuditLog {
    return AuditLog.create(level, 'auth', action, message, userId, metadata, 'auth');
  }

  /**
   * Factory method para logs de seguridad
   *
   * **Propósito**: Crea logs específicos para eventos relacionados con seguridad
   * con nivel de advertencia por defecto para facilitar monitoreo.
   *
   * **Casos de uso**:
   * - Intentos de acceso no autorizado
   * - Violaciones de permisos
   * - Ataques detectados
   * - Cambios en configuración de seguridad
   * - Anomalías en patrones de uso
   *
   * @param action - Tipo de evento de seguridad
   * @param message - Descripción del evento de seguridad
   * @param userId - Usuario involucrado (null para ataques anónimos)
   * @param metadata - Contexto de seguridad (IP, resource, método, etc.)
   * @param level - Nivel de severidad ('warn' por defecto)
   */
  static createSecurityLog(
    action: AuditLogAction,
    message: string,
    userId: UserId | null,
    metadata: IAuditLogMetadata,
    level: AuditLogLevel = 'warn',
  ): AuditLog {
    return AuditLog.create(level, 'security', action, message, userId, metadata, 'security');
  }

  /**
   * Factory method para logs de excepciones
   *
   * **Propósito**: Crea logs específicos para errores y excepciones del sistema
   * con configuración optimizada para debugging y resolución de problemas.
   *
   * **Casos de uso**:
   * - Excepciones no controladas
   * - Errores de validación de dominio
   * - Fallos en servicios externos
   * - Errores de configuración
   * - Timeouts y fallos de red
   *
   * @param message - Descripción del error o excepción
   * @param userId - Usuario asociado al contexto del error
   * @param metadata - Contexto técnico (stack trace, error code, etc.)
   * @param level - Nivel de severidad ('error' por defecto)
   */
  static createExceptionLog(
    message: string,
    userId: UserId | null,
    metadata: IAuditLogMetadata,
    level: AuditLogLevel = 'error',
  ): AuditLog {
    return AuditLog.create(level, 'exception', 'exception', message, userId, metadata, 'exception');
  }

  /**
   * Factory method para logs de API
   *
   * **Propósito**: Crea logs específicos para llamadas API y respuestas
   * con contexto optimizado para monitoreo de servicios.
   *
   * **Casos de uso**:
   * - Request/Response logging
   * - Monitoreo de performance de API
   * - Análisis de uso de endpoints
   * - Rate limiting events
   * - Validación de inputs
   *
   * @param action - Tipo de operación API (create, read, update, delete, etc.)
   * @param message - Descripción de la operación API
   * @param userId - Usuario que realiza la llamada
   * @param metadata - Contexto HTTP (method, url, status, duration, etc.)
   * @param level - Nivel de severidad ('info' por defecto)
   */
  static createApiLog(
    action: AuditLogAction,
    message: string,
    userId: UserId | null,
    metadata: IAuditLogMetadata,
    level: AuditLogLevel = 'info',
  ): AuditLog {
    return AuditLog.create(level, 'api', action, message, userId, metadata, 'api');
  }

  /**
   * Factory method para logs de transacciones
   *
   * **Propósito**: Crea logs específicos para operaciones de base de datos
   * con contexto optimizado para debugging de transacciones.
   *
   * **Casos de uso**:
   * - Inicio/commit/rollback de transacciones
   * - Operaciones CRUD en entidades
   * - Violaciones de constraints
   * - Deadlocks y timeouts
   * - Migraciones de datos
   *
   * @param action - Tipo de operación de transacción
   * @param message - Descripción de la operación de BD
   * @param userId - Usuario asociado a la transacción
   * @param metadata - Contexto de BD (tables, duration, query info, etc.)
   * @param level - Nivel de severidad ('debug' por defecto)
   */
  static createTransactionLog(
    action: AuditLogAction,
    message: string,
    userId: UserId | null,
    metadata: IAuditLogMetadata,
    level: AuditLogLevel = 'debug',
  ): AuditLog {
    return AuditLog.create(level, 'transaction', action, message, userId, metadata, 'transaction');
  }

  /**
   * Obtiene entrada de log formateada para visualización
   *
   * **Propósito**: Genera una representación textual estructurada del log
   * siguiendo un formato consistente para análisis manual y herramientas de logging.
   *
   * **Formato**: `TIMESTAMP [LEVEL] [CONTEXT] [TYPE:ACTION] [USER_INFO] - MESSAGE`
   *
   * @returns String formateado con todos los elementos clave del audit log
   *
   * @example
   * ```typescript
   * const log = AuditLog.createAuthLog('login', 'User logged in', userId, metadata);
   * console.log(log.getFormattedEntry());
   * // Output: "2025-08-06T19:30:15.123Z [INFO] [AUTH] [AUTH:LOGIN] [User: user-123] - User logged in"
   * ```
   */
  getFormattedEntry(): string {
    const timestamp = this.timestamp.toISOString();
    const userInfo = this.userId ? `[User: ${this.userId.getValue()}]` : '[System]';
    const contextInfo = `[${this.context.toUpperCase()}]`;
    const levelInfo = `[${this.level.toUpperCase()}]`;
    const typeInfo = `[${this.type.toUpperCase()}:${this.action.toUpperCase()}]`;

    return `${timestamp} ${levelInfo} ${contextInfo} ${typeInfo} ${userInfo} - ${this.message}`;
  }

  /**
   * Verifica si este log contiene información sensible
   *
   * **Propósito**: Identifica logs que requieren manejo especial de seguridad
   * para aplicar políticas de retención diferenciadas y controles de acceso.
   *
   * **Criterios de sensibilidad**:
   * - Tipos sensibles: auth, security, exception
   * - Acciones sensibles: login, logout, reset, error, exception
   *
   * @returns true si el log contiene información sensible
   *
   * @example
   * ```typescript
   * const authLog = AuditLog.createAuthLog('login', 'Login failed', null, metadata);
   * if (authLog.isSensitive()) {
   *   // Aplicar políticas especiales de retención y acceso
   *   applySecurityPolicies(authLog);
   * }
   * ```
   */
  isSensitive(): boolean {
    const sensitiveTypes: AuditLogType[] = ['auth', 'security', 'exception'];
    const sensitiveActions: AuditLogAction[] = ['login', 'logout', 'reset', 'error', 'exception'];

    return sensitiveTypes.includes(this.type) || sensitiveActions.includes(this.action);
  }

  /**
   * Obtiene metadata sanitizada (remueve información sensible)
   *
   * **Propósito**: Proporciona versión segura de la metadata para logging público,
   * análisis no privilegiado y cumplimiento de políticas de privacidad.
   *
   * **Campos sanitizados**: password, passwordHash, token, secret, key, authorization
   * y cualquier campo anidado que contenga estos términos.
   *
   * **Comportamiento**:
   * - Reemplaza valores sensibles con '[REDACTED]'
   * - Procesa recursivamente objetos y arrays anidados
   * - Preserva estructura de datos original
   * - No modifica la instancia original (immutable)
   *
   * @returns Copia de metadata con información sensible removida
   *
   * @example
   * ```typescript
   * const metadata = {
   *   email: 'user@example.com',
   *   password: 'secretPass123',
   *   userAgent: 'Mozilla/5.0...',
   *   authToken: 'jwt-token-here'
   * };
   *
   * const log = AuditLog.create('info', 'auth', 'login', 'Login attempt', null, metadata);
   * const safeMetadata = log.getSanitizedMetadata();
   *
   * // safeMetadata = {
   * //   email: 'user@example.com',
   * //   password: '[REDACTED]',
   * //   userAgent: 'Mozilla/5.0...',
   * //   authToken: '[REDACTED]'
   * // }
   * ```
   */
  getSanitizedMetadata(): IAuditLogMetadata {
    const sanitized = { ...this.metadata };

    // Remove sensitive fields
    const sensitiveFields = ['password', 'passwordHash', 'token', 'secret', 'key', 'authorization'];

    Object.keys(sanitized).forEach(key => {
      if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
        sanitized[key] = '[REDACTED]';
      }

      // Sanitize nested objects
      if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = this.sanitizeObject(sanitized[key]);
      }
    });

    return sanitized;
  }

  private sanitizeObject(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }

    if (typeof obj === 'object' && obj !== null) {
      const sanitized: any = {};
      Object.keys(obj).forEach(key => {
        const sensitiveFields = [
          'password',
          'passwordHash',
          'token',
          'secret',
          'key',
          'authorization',
        ];
        if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
          sanitized[key] = '[REDACTED]';
        } else {
          sanitized[key] = this.sanitizeObject(obj[key]);
        }
      });

      return sanitized;
    }

    return obj;
  }
}
