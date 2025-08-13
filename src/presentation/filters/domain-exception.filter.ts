import { Catch, ExceptionFilter, ArgumentsHost, HttpStatus, Inject } from '@nestjs/common';
import { Response } from 'express';
import { DomainException } from '@core/exceptions/domain-exceptions';
import { ILogger } from '@core/interfaces/logger.interface';
import { LOGGER_SERVICE } from '@shared/constants/tokens';

/**
 * Filtro de Excepciones de Dominio - Mapeo automático a respuestas HTTP
 *
 * **Propósito**: Exception filter especializado que traduce excepciones del dominio
 * en respuestas HTTP apropiadas, manteniendo Clean Architecture al separar
 * concerns de HTTP de la lógica de dominio.
 *
 * **Responsabilidades**:
 * - Captura todas las excepciones derivadas de DomainException
 * - Mapea códigos de error de dominio a status codes HTTP específicos
 * - Genera respuestas HTTP estructuradas y consistentes
 * - Añade headers específicos para ciertos tipos de error
 * - Logging detallado para debugging y monitoreo
 * - Preserva contexto de error sin exponer detalles internos
 *
 * **Arquitectura Clean Architecture**:
 * - Reside en presentation layer (maneja concerns HTTP)
 * - Traduce domain language a HTTP semantics
 * - Permite que domain layer lance excepciones puras
 * - No contamina dominio con HTTP status codes
 * - Centraliza manejo de errores para API consistency
 *
 * **Mapeos implementados**:
 * - **Authentication**: AUTHENTICATION_FAILED → 401 Unauthorized
 * - **Authorization**: INSUFFICIENT_PERMISSIONS → 403 Forbidden
 * - **Validation**: INVALID_VALUE_OBJECT → 400 Bad Request
 * - **Business Rules**: BUSINESS_RULE_VIOLATION → 400 Bad Request
 * - **Not Found**: ENTITY_NOT_FOUND → 404 Not Found
 * - **Conflicts**: ENTITY_ALREADY_EXISTS → 409 Conflict
 * - **Rate Limiting**: RATE_LIMIT_EXCEEDED → 429 Too Many Requests
 * - **System**: DATABASE_CONNECTION_FAILED → 503 Service Unavailable
 *
 * **Características especiales**:
 * - **Headers dinámicos**: Retry-After para rate limiting, X-Banned-Until para bans
 * - **Contexto preservado**: Información adicional en campo 'details'
 * - **Logging comprehensivo**: Code, message, context y stack trace
 * - **Fallback seguro**: 500 Internal Server Error para códigos no mapeados
 * - **Timestamps**: ISO timestamps para tracking temporal
 *
 * **Estructura de respuesta**:
 * ```json
 * {
 *   "statusCode": 400,
 *   "timestamp": "2025-08-06T19:30:15.123Z",
 *   "error": "Bad Request",
 *   "message": "Invalid email format",
 *   "code": "INVALID_VALUE_OBJECT",
 *   "details": { "field": "email", "value": "invalid-email" }
 * }
 * ```
 *
 * @example
 * ```typescript
 * // En un domain service:
 * throw new InvalidValueObjectException('Invalid email format', 'Email', { field: 'email' });
 *
 * // Automáticamente convertido por el filter a:
 * // HTTP 400 Bad Request con estructura JSON consistente
 *
 * // Rate limiting con header especial:
 * throw new RateLimitExceededException('Rate limit exceeded', { retryAfter: 60 });
 * // → HTTP 429 + Header: Retry-After: 60
 * ```
 *
 * **Integración con sistema**:
 * - Registrado globalmente en app.module.ts
 * - Captura excepciones de todos los controllers
 * - Compatible con otros exception filters
 * - Integrado con sistema de logging
 * - Usado por audit system para error tracking
 */
@Catch(DomainException)
export class DomainExceptionFilter implements ExceptionFilter {
  constructor(@Inject(LOGGER_SERVICE) private readonly logger: ILogger) {
    this.logger.setContext(DomainExceptionFilter.name);
  }

  // Mapping of domain exception codes to HTTP status codes
  private readonly statusCodeMap = new Map<string, HttpStatus>([
    // Entity exceptions
    ['ENTITY_NOT_FOUND', HttpStatus.NOT_FOUND],
    ['ENTITY_ALREADY_EXISTS', HttpStatus.CONFLICT],

    // Input validation exceptions
    ['INVALID_INPUT', HttpStatus.BAD_REQUEST],
    ['INVALID_VALUE_OBJECT', HttpStatus.BAD_REQUEST],

    // Authentication exceptions
    ['AUTHENTICATION_FAILED', HttpStatus.UNAUTHORIZED],
    ['INVALID_CREDENTIALS', HttpStatus.UNAUTHORIZED],
    ['ACCOUNT_LOCKED', HttpStatus.FORBIDDEN],
    ['TWO_FACTOR_REQUIRED', HttpStatus.UNAUTHORIZED],
    ['INVALID_SESSION', HttpStatus.UNAUTHORIZED],

    // Authorization exceptions
    ['FORBIDDEN_ACTION', HttpStatus.FORBIDDEN],
    ['INSUFFICIENT_PERMISSIONS', HttpStatus.FORBIDDEN],

    // OTP exceptions
    ['OTP_EXPIRED', HttpStatus.BAD_REQUEST],
    ['OTP_INVALID', HttpStatus.BAD_REQUEST],

    // Rate limiting exceptions
    ['RATE_LIMIT_EXCEEDED', HttpStatus.TOO_MANY_REQUESTS],
    ['THROTTLING_VIOLATION', HttpStatus.TOO_MANY_REQUESTS],
    ['INVALID_THROTTLE_IDENTIFIER', HttpStatus.BAD_REQUEST],

    // Business rule violations
    ['BUSINESS_RULE_VIOLATION', HttpStatus.BAD_REQUEST],

    // User domain exceptions
    ['USER_NOT_ELIGIBLE_FOR_ROLE', HttpStatus.FORBIDDEN],
    ['USER_ALREADY_HAS_ROLE', HttpStatus.CONFLICT],
    ['INACTIVE_USER', HttpStatus.FORBIDDEN],
    ['CANNOT_REMOVE_LAST_ROLE', HttpStatus.FORBIDDEN],
    ['USER_BANNED', HttpStatus.FORBIDDEN],

    // Role domain exceptions
    ['CANNOT_DELETE_DEFAULT_ROLE', HttpStatus.FORBIDDEN],
    ['ROLE_HAS_ASSIGNED_USERS', HttpStatus.CONFLICT],
    ['PERMISSION_ALREADY_ASSIGNED', HttpStatus.CONFLICT],

    // File domain exceptions
    ['FILE_NOT_OWNED_BY_USER', HttpStatus.FORBIDDEN],
    ['FILE_ACCESS_DENIED', HttpStatus.FORBIDDEN],
    ['INVALID_FILE_OPERATION', HttpStatus.BAD_REQUEST],

    // System exceptions
    ['HEALTH_CHECK_FAILED', HttpStatus.SERVICE_UNAVAILABLE],
    ['DATABASE_CONNECTION_FAILED', HttpStatus.SERVICE_UNAVAILABLE],
    ['CONFIGURATION_ERROR', HttpStatus.INTERNAL_SERVER_ERROR],

    // Permission and validation exceptions
    ['PERMISSION_EXCLUDE_VIOLATION', HttpStatus.FORBIDDEN],
    ['INVALID_INDUSTRY_OPERATION_CHANNEL', HttpStatus.BAD_REQUEST],
    ['INVALID_INDUSTRY_SECTOR', HttpStatus.BAD_REQUEST],

    // AI Persona domain exceptions
    ['AI_PERSONA_NOT_FOUND', HttpStatus.NOT_FOUND],
    ['AI_PERSONA_KEY_NAME_ALREADY_EXISTS', HttpStatus.CONFLICT],
    ['INVALID_AI_PERSONA_NAME', HttpStatus.BAD_REQUEST],
    ['INVALID_AI_PERSONA_KEY_NAME', HttpStatus.BAD_REQUEST],
    ['INVALID_AI_PERSONA_TONE', HttpStatus.BAD_REQUEST],
    ['INVALID_AI_PERSONA_PERSONALITY', HttpStatus.BAD_REQUEST],
    ['INVALID_AI_PERSONA_OBJECTIVE', HttpStatus.BAD_REQUEST],
    ['INVALID_AI_PERSONA_SHORT_DETAILS', HttpStatus.BAD_REQUEST],
    ['UNAUTHORIZED_AI_PERSONA_MODIFICATION', HttpStatus.FORBIDDEN],
    ['COMPANY_ALREADY_HAS_ACTIVE_AI_PERSONA', HttpStatus.CONFLICT],
    ['CANNOT_MODIFY_DEFAULT_AI_PERSONA', HttpStatus.FORBIDDEN],
    ['CANNOT_DELETE_DEFAULT_AI_PERSONA', HttpStatus.FORBIDDEN],
    ['AI_PERSONA_COMPANY_ASSIGNMENT_REMOVAL_FAILED', HttpStatus.INTERNAL_SERVER_ERROR],
  ]);

  catch(exception: DomainException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    // Get HTTP status code from mapping, default to INTERNAL_SERVER_ERROR
    const status = this.statusCodeMap.get(exception.code) ?? HttpStatus.INTERNAL_SERVER_ERROR;

    // Log the exception for debugging
    this.logger.error(
      `Domain exception caught: ${exception.name} - code: ${exception.code}, message: ${exception.message}, context: ${JSON.stringify(exception.context)}`,
      exception.stack,
    );

    // Build error response
    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      error: this.getErrorName(status),
      message: exception.message,
      code: exception.code,
      ...(exception.context && { details: exception.context }),
    };

    // Add specific headers for certain exception types
    if (exception.code === 'RATE_LIMIT_EXCEEDED' && exception.context?.retryAfter) {
      response.header('Retry-After', exception.context.retryAfter.toString());
    }

    if (exception.code === 'USER_BANNED' && exception.context?.bannedUntil) {
      response.header('X-Banned-Until', String(exception.context.bannedUntil));
    }

    response.status(status).json(errorResponse);
  }

  /**
   * Get user-friendly error name from HTTP status code
   */
  private getErrorName(status: HttpStatus): string {
    switch (status) {
      case HttpStatus.BAD_REQUEST:
        return 'Bad Request';
      case HttpStatus.UNAUTHORIZED:
        return 'Unauthorized';
      case HttpStatus.FORBIDDEN:
        return 'Forbidden';
      case HttpStatus.NOT_FOUND:
        return 'Not Found';
      case HttpStatus.CONFLICT:
        return 'Conflict';
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'Too Many Requests';
      case HttpStatus.INTERNAL_SERVER_ERROR:
        return 'Internal Server Error';
      case HttpStatus.SERVICE_UNAVAILABLE:
        return 'Service Unavailable';
      default:
        return 'Unknown Error';
    }
  }
}
