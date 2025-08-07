/**
 * Enum que define todas las posibles razones de fallo en la autenticación
 *
 * **Propósito**: Proporciona un conjunto tipado y exhaustivo de razones por las cuales
 * una autenticación puede fallar, permitiendo logging específico y manejo de errores granular.
 *
 * **Casos de uso**:
 * - Audit logging con razones específicas de fallo
 * - Respuestas de error diferenciadas por tipo de fallo
 * - Análisis de seguridad y patrones de fallo
 * - Debugging y troubleshooting de problemas de autenticación
 *
 * **Arquitectura**: Siguiendo Clean Architecture, este enum reside en la capa de dominio
 * y puede ser usado por todas las capas superiores (aplicación, presentación)
 *
 * @example
 * ```typescript
 * // En un servicio de validación
 * if (!user) {
 *   return {
 *     success: false,
 *     failureReason: AuthFailureReason.USER_NOT_FOUND
 *   };
 * }
 *
 * // En logging de auditoría
 * this.auditLogService.logSecurity('login', `Login failed: ${reason}`, ...);
 * ```
 */
export enum AuthFailureReason {
  /** Usuario no existe en la base de datos */
  USER_NOT_FOUND = 'user_not_found',

  /** Password proporcionado es incorrecto */
  INVALID_PASSWORD = 'invalid_password',

  /** Cuenta de usuario está desactivada */
  USER_INACTIVE = 'user_inactive',

  /** Usuario está baneado temporalmente o permanentemente */
  USER_BANNED = 'user_banned',

  /** Email no ha sido verificado y la verificación está habilitada */
  EMAIL_NOT_VERIFIED = 'email_not_verified',

  /** Se requiere autenticación de dos factores (OTP) */
  OTP_REQUIRED = 'otp_required',

  /** Código OTP proporcionado es inválido */
  OTP_INVALID = 'otp_invalid',

  /** Sesión ha expirado */
  SESSION_EXPIRED = 'session_expired',

  /** Demasiados intentos de autenticación fallidos */
  TOO_MANY_ATTEMPTS = 'too_many_attempts',

  /** Cuenta bloqueada por políticas de seguridad */
  ACCOUNT_LOCKED = 'account_locked',

  /** Formato de email es inválido */
  INVALID_EMAIL_FORMAT = 'invalid_email_format',

  /** Error del sistema durante el proceso de autenticación */
  SYSTEM_ERROR = 'system_error',
}

/**
 * Interfaz que representa el resultado de una validación de autenticación
 *
 * **Propósito**: Estructura estandarizada para comunicar el resultado de validaciones
 * de credenciales, incluyendo detalles específicos sobre éxito o fallo.
 *
 * **Casos de uso**:
 * - Resultado de UserService.validateCredentials()
 * - Base para construir respuestas de login
 * - Información para audit logging
 * - Debugging y troubleshooting
 *
 * @example
 * ```typescript
 * // Uso típico en servicio de validación
 * const result: IAuthValidationResult = {
 *   success: false,
 *   failureReason: AuthFailureReason.USER_BANNED,
 *   message: 'Account is banned until 2025-12-31',
 *   details: {
 *     bannedUntil: new Date('2025-12-31'),
 *     banReason: 'Policy violation'
 *   }
 * };
 * ```
 */
export interface IAuthValidationResult {
  /** Indica si la validación fue exitosa */
  success: boolean;

  /** Entidad User si la validación fue exitosa */
  user?: any; // Will be User entity

  /** Razón específica del fallo si success=false */
  failureReason?: AuthFailureReason;

  /** Mensaje descriptivo del resultado */
  message?: string;

  /** Detalles adicionales específicos del tipo de fallo/éxito */
  details?: {
    /** Fecha hasta cuando el usuario está baneado */
    bannedUntil?: Date;
    /** Razón del ban */
    banReason?: string;
    /** Intentos restantes antes de bloqueo */
    attemptsRemaining?: number;
    /** Tiempo hasta desbloqueo */
    lockoutTime?: Date;
    /** Si se requiere verificación de email */
    emailVerificationRequired?: boolean;
    /** Si se requiere OTP */
    requiresOtp?: boolean;
    /** Mensaje de error del sistema */
    systemError?: string;
    /** Tipo de error técnico */
    errorType?: string;
  };
}

/**
 * Interfaz que representa el resultado completo del flujo de login
 *
 * **Propósito**: Estructura unificada para manejar todos los posibles resultados
 * del proceso de login, incluyendo flujos multi-paso como verificación de email y 2FA.
 *
 * **Casos de uso**:
 * - Resultado de AuthenticationValidationService.validateLoginFlow()
 * - Comunicación entre capa de aplicación y presentación
 * - Manejo de flujos de autenticación complejos
 * - Base para respuestas HTTP estandarizadas
 *
 * **Flujos soportados**:
 * - Login exitoso completo (tokens + user data)
 * - Login que requiere verificación de email
 * - Login que requiere 2FA/OTP
 * - Login fallido con razones específicas
 *
 * @example
 * ```typescript
 * // Login exitoso completo
 * const result: ILoginFlowResult = {
 *   success: true,
 *   nextStep: 'complete',
 *   authResponse: { accessToken, refreshToken, user }
 * };
 *
 * // Login que requiere email verification
 * const result: ILoginFlowResult = {
 *   success: true,
 *   nextStep: 'email_verification',
 *   requiresEmailVerification: true,
 *   userId: 'user-123',
 *   email: 'user@example.com'
 * };
 *
 * // Login fallido
 * const result: ILoginFlowResult = {
 *   success: false,
 *   failureReason: AuthFailureReason.INVALID_PASSWORD,
 *   auditDetails: { email, duration: 150, ... }
 * };
 * ```
 */
export interface ILoginFlowResult {
  /** Indica si el proceso de login fue exitoso */
  success: boolean;

  /** Siguiente paso requerido en el flujo de login */
  nextStep?: 'complete' | 'email_verification' | 'otp_required';

  /** Respuesta de autenticación completa (si nextStep='complete') */
  authResponse?: any; // AuthResponse

  /** Indica si se requiere verificación de email */
  requiresEmailVerification?: boolean;

  /** Indica si se requiere código OTP/2FA */
  requiresOtp?: boolean;

  /** ID del usuario para continuación del flujo */
  userId?: string;

  /** Email del usuario para continuación del flujo */
  email?: string;

  /** Mensaje descriptivo para el usuario */
  message?: string;

  /** Razón del fallo si success=false */
  failureReason?: AuthFailureReason;

  /** Detalles para audit logging (siempre incluidos) */
  auditDetails?: {
    /** Email del intento de login */
    email: string;
    /** User agent del cliente */
    userAgent?: string;
    /** Dirección IP del cliente */
    ipAddress?: string;
    /** Duración del proceso en millisegundos */
    duration: number;
    /** Razón del fallo si aplica */
    failureReason?: AuthFailureReason;
    /** Cualquier metadata adicional */
    [key: string]: any;
  };
}
