import { Injectable, Inject } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { UserService } from './user.service';
import { AuthService } from './auth.service';
import { SessionService } from './session.service';
import { UserBanService } from './user-ban.service';
import { PermissionCollectionService } from './permission-collection.service';
import { BusinessConfigurationService } from './business-configuration.service';
import { ITokenProvider } from '@core/interfaces/token-provider.interface';
import { TOKEN_PROVIDER, LOGGER_SERVICE, BOT_TOKEN_REPOSITORY } from '@shared/constants/tokens';
import { ILogger } from '@core/interfaces/logger.interface';
import {
  AuthFailureReason,
  IAuthValidationResult,
  ILoginFlowResult,
} from '@shared/constants/auth-failure-reason.enum';
import { ILoginAuthResponse } from '@application/dtos/_responses/auth/login-auth-response.interface';
import { UserId } from '@core/value-objects/user-id.vo';
import { AuthResponse } from '@application/dtos/_responses/user/user.response';
import { UserMapper } from '@application/mappers/user.mapper';
import { User } from '@core/entities/user.entity';
import { SendVerificationEmailCommand } from '@application/commands/auth/send-verification-email.command';
import { RolesEnum } from '@shared/constants/enums';
import { IBotTokenRepository } from '@core/repositories/bot-token.repository.interface';
import { v4 as uuidv4 } from 'uuid';

/**
 * Servicio integral de validación de autenticación
 *
 * **Propósito**: Centraliza y orquesta todo el flujo de validación de login,
 * desde la verificación de credenciales hasta la generación de tokens,
 * incluyendo audit logging automático y manejo de errores robusto.
 *
 * **Responsabilidades**:
 * - Validación completa de credenciales (email, password, estado usuario)
 * - Manejo de flujos multi-paso (email verification, 2FA)
 * - Generación de tokens y sesiones
 * - Audit logging automático de todos los eventos
 * - Manejo granular de errores con información detallada
 * - Aplicación de políticas de negocio (bans, verificaciones, etc.)
 *
 * **Arquitectura**: Servicio de dominio siguiendo Clean Architecture
 * - Reside en la capa de dominio (core)
 * - Orquesta otros servicios de dominio
 * - Independiente de infrastructure y presentation
 * - Usado por application layer (commands)
 *
 * **Beneficios**:
 * - Commands más limpios y enfocados
 * - Reutilización de lógica de validación
 * - Logging consistente y comprehensivo
 * - Manejo de errores centralizado
 * - Fácil testing y mantenimiento
 *
 * @example
 * ```typescript
 * // Uso típico en un command handler
 * const result = await this.authValidationService.validateLoginFlow(
 *   email, password, userAgent, ipAddress
 * );
 *
 * if (!result.success) {
 *   throw new UnauthorizedException();
 * }
 *
 * // Manejo de flujos multi-paso
 * switch (result.nextStep) {
 *   case 'email_verification':
 *     return { requiresEmailVerification: true, ... };
 *   case 'otp_required':
 *     return { requiresOtp: true, ... };
 *   case 'complete':
 *     return result.authResponse;
 * }
 * ```
 *
 * **Dependencias**:
 * - UserService: Validación de credenciales
 * - AuthService: Operaciones de autenticación
 * - SessionService: Manejo de sesiones
 * - UserBanService: Validación de bans
 * - PermissionCollectionService: Recopilación de permisos
 * - BusinessConfigurationService: Políticas de negocio
 * - AuditLogService: Logging de auditoría
 * - TokenProvider: Generación de JWT tokens
 */
@Injectable()
export class AuthenticationValidationService {
  constructor(
    private readonly userService: UserService,
    private readonly authService: AuthService,
    private readonly sessionService: SessionService,
    private readonly userBanService: UserBanService,
    private readonly permissionCollectionService: PermissionCollectionService,
    private readonly businessConfigService: BusinessConfigurationService,
    private readonly commandBus: CommandBus,
    @Inject(TOKEN_PROVIDER)
    private readonly tokenProvider: ITokenProvider,
    @Inject(BOT_TOKEN_REPOSITORY)
    private readonly botTokenRepository: IBotTokenRepository,
    @Inject(LOGGER_SERVICE)
    private readonly logger: ILogger,
  ) {
    this.logger.setContext(AuthenticationValidationService.name);
  }

  /**
   * Ejecuta el flujo completo de validación de login
   *
   * **Propósito**: Método principal que orquesta todo el proceso de autenticación,
   * desde la validación de credenciales hasta la generación de tokens o manejo de flujos multi-paso.
   *
   * **Proceso**:
   * 1. Validación de credenciales básicas (email/password)
   * 2. Validaciones de negocio adicionales (bans, estado usuario)
   * 3. Actualización de último login
   * 4. Verificación de requisitos (email verification, 2FA)
   * 5. Generación de tokens y sesión (si es login completo)
   * 6. Audit logging automático de todo el proceso
   *
   * **Características**:
   * - Manejo exhaustivo de errores con información detallada
   * - Audit logging automático para todos los escenarios
   * - Soporte para flujos multi-paso (email verification, 2FA)
   * - Performance tracking (duración de operaciones)
   * - Context information (IP, user agent) para seguridad
   *
   * @param email - Email del usuario intentando autenticarse
   * @param password - Password en texto plano (será hasheado para comparación)
   * @param userAgent - User agent del cliente (para audit logging y sesiones)
   * @param ipAddress - Dirección IP del cliente (para audit logging y seguridad)
   *
   * @returns Promise<ILoginFlowResult> - Resultado estructurado indicando éxito/fallo y siguiente paso
   *
   * @example
   * ```typescript
   * const result = await this.authValidationService.validateLoginFlow(
   *   'user@example.com',
   *   'plainTextPassword',
   *   'Mozilla/5.0...',
   *   '192.168.1.100'
   * );
   *
   * if (!result.success) {
   *   // Login falló - información detallada en result.failureReason y result.auditDetails
   *   console.log(`Login failed: ${result.failureReason}`);
   *   return;
   * }
   *
   * // Login exitoso - verificar próximo paso
   * switch (result.nextStep) {
   *   case 'complete':
   *     // Login completo - usar result.authResponse
   *     break;
   *   case 'email_verification':
   *     // Requiere verificación de email
   *     break;
   *   case 'otp_required':
   *     // Requiere 2FA
   *     break;
   * }
   * ```
   *
   * **Audit Logging**: Este método automaticamente registra:
   * - Intentos de login exitosos y fallidos
   * - Razones específicas de fallo
   * - Información contextual (IP, user agent, duración)
   * - Detalles técnicos para debugging
   */
  async validateLoginFlow(
    email: string,
    password: string,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<ILoginFlowResult> {
    const startTime = performance.now();

    try {
      // Step 1: Validate credentials
      const validationResult = await this.userService.validateCredentials(email, password);

      if (!validationResult.success) {
        return this.buildFailureResult(
          email,
          validationResult.failureReason!,
          validationResult,
          userAgent,
          ipAddress,
          startTime,
        );
      }

      const user = validationResult.user as User;

      // Step 2: Additional business validations
      const businessValidation = await this.performBusinessValidations(user, email);
      if (!businessValidation.success) {
        return this.buildFailureResult(
          email,
          businessValidation.failureReason!,
          businessValidation,
          userAgent,
          ipAddress,
          startTime,
          user.id,
        );
      }

      // Step 3: Special handling for BOT users
      const isBotUser = user.roles.some(role => role.name === RolesEnum.BOT);
      if (isBotUser) {
        return await this.handleBotLogin(user, email, userAgent, ipAddress, startTime);
      }

      // Step 4: Update last login (regular users only)
      await this.authService.updateLastLogin(user.id.getValue());

      // Step 5: Check email verification requirements
      const emailVerificationResult = await this.checkEmailVerification(user, email);
      if (emailVerificationResult.nextStep === 'email_verification') {
        return await this.buildEmailVerificationResult(
          user,
          email,
          userAgent,
          ipAddress,
          startTime,
        );
      }

      // Step 6: Check OTP requirements
      if (user.otpEnabled) {
        return this.buildOtpRequiredResult(user, email, userAgent, ipAddress, startTime);
      }

      // Step 7: Complete login - generate tokens and session
      const authResponse = await this.completeLogin(user, userAgent, ipAddress);

      // Step 8: Log successful authentication
      await this.logSuccessfulAuth(user, email, userAgent, ipAddress, startTime);

      return {
        success: true,
        nextStep: 'complete',
        authResponse,
        auditDetails: {
          email,
          userAgent,
          ipAddress,
          duration: performance.now() - startTime,
        },
      };
    } catch (error) {
      // System error during login flow
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorType = error?.constructor?.name || 'Unknown';

      this.logger.error({
        message: 'System error during login flow',
        email,
        error: errorMessage,
        errorType,
        stack: error instanceof Error ? error.stack : undefined,
      });

      return this.buildFailureResult(
        email,
        AuthFailureReason.SYSTEM_ERROR,
        {
          success: false,
          failureReason: AuthFailureReason.SYSTEM_ERROR,
          details: {
            systemError: errorMessage,
            errorType,
          },
        },
        userAgent,
        ipAddress,
        startTime,
      );
    }
  }

  /**
   * Perform additional business validations
   */
  private async performBusinessValidations(
    user: User,
    email: string,
  ): Promise<IAuthValidationResult> {
    try {
      // Validate user is not banned
      this.userBanService.validateUserNotBanned(user);

      return {
        success: true,
        user,
      };
    } catch (_error) {
      // User is banned
      return {
        success: false,
        failureReason: AuthFailureReason.USER_BANNED,
        message: `User ${email} is banned`,
        details: {
          bannedUntil: user.bannedUntil,
          banReason: user.banReason,
        },
      };
    }
  }

  /**
   * Check email verification requirements
   */
  private async checkEmailVerification(user: User, email: string): Promise<{ nextStep?: string }> {
    const emailConfig = this.businessConfigService.getEmailVerificationConfig();
    const isEmailVerified = await this.authService.isEmailVerified(email);

    if (emailConfig.enabled && !isEmailVerified) {
      return { nextStep: 'email_verification' };
    }

    return {};
  }

  /**
   * Complete the login process - generate tokens and session
   */
  private async completeLogin(
    user: User,
    userAgent?: string,
    ipAddress?: string,
  ): Promise<ILoginAuthResponse> {
    // Collect user permissions
    const userPermissions = await this.permissionCollectionService.collectUserPermissions(user);

    // Generate session and tokens
    const sessionToken = uuidv4();
    const { accessToken, refreshToken } = await this.tokenProvider.generateTokens(
      user,
      Array.from(userPermissions),
      sessionToken,
    );

    // Register session
    await this.sessionService.createSession(
      user.id.getValue(),
      sessionToken,
      refreshToken,
      userAgent || null,
      ipAddress || '?',
    );

    return {
      accessToken,
      refreshToken,
      user: UserMapper.toAuthResponse(user),
      message: 'Login successful',
    };
  }

  /**
   * Build failure result with audit logging
   */
  private buildFailureResult(
    email: string,
    failureReason: AuthFailureReason,
    validationResult: IAuthValidationResult,
    userAgent?: string,
    ipAddress?: string,
    startTime?: number,
    _userId?: UserId,
  ): ILoginFlowResult {
    const duration = startTime ? performance.now() - startTime : 0;

    // Log detailed failure information
    this.logger.warn({
      message: 'Login failed',
      email,
      failureReason,
      details: validationResult.details,
      duration,
    });

    // Comprehensive audit log
    // Removed audit log call

    return {
      success: false,
      failureReason,
      message: 'Invalid credentials',
      auditDetails: {
        email,
        userAgent,
        ipAddress,
        duration,
        failureReason,
        ...validationResult.details,
      },
    };
  }

  /**
   * Build email verification required result
   *
   * **NUEVO**: Ahora envía automáticamente el email de verificación y SMS (si aplica)
   * cuando el login requiere verificación de email, como si se hubiera llamado
   * el endpoint POST /api/auth/email/send-verification
   */
  private async buildEmailVerificationResult(
    user: User,
    email: string,
    userAgent?: string,
    ipAddress?: string,
    startTime?: number,
  ): Promise<ILoginFlowResult> {
    const _duration = startTime ? performance.now() - startTime : 0;

    // Audit log for email verification requirement
    // Removed audit log call

    // **NUEVA FUNCIONALIDAD**: Enviar automáticamente email de verificación y SMS
    try {
      const phoneNumber = user.profile?.phone; // Obtener teléfono del perfil del usuario

      // Ejecutar comando de envío de verificación
      // Usando el propio usuario como "currentUser" para evitar problemas de autorización
      const verificationCommand = new SendVerificationEmailCommand(
        {
          email: user.email.getValue(),
          phoneNumber, // Se incluye si existe, sino undefined
        },
        user.id.getValue(), // currentUserId - el propio usuario
        ['admin'], // currentUserRoles - damos permisos admin para poder enviar
        user.companyId?.getValue() || null, // currentUserCompanyId
      );

      await this.commandBus.execute(verificationCommand);

      this.logger.log({
        message: 'Automatic verification email and SMS sent during login flow',
        userId: user.id.getValue(),
        email: user.email.getValue(),
        phoneNumber: phoneNumber ? '***' + phoneNumber.slice(-4) : 'none',
      });
    } catch (error) {
      // Si falla el envío, logueamos el error pero no interrumpimos el flujo de login
      this.logger.error({
        message: 'Failed to send automatic verification during login',
        userId: user.id.getValue(),
        email: user.email.getValue(),
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return {
      success: true,
      nextStep: 'email_verification',
      requiresEmailVerification: true,
      userId: user.id.getValue(),
      email: user.email.getValue(),
      message: 'Verification email sent', // Actualizado para reflejar que se envió
    };
  }

  /**
   * Build OTP required result
   */
  private buildOtpRequiredResult(
    user: User,
    email: string,
    userAgent?: string,
    ipAddress?: string,
    startTime?: number,
  ): ILoginFlowResult {
    const _duration = startTime ? performance.now() - startTime : 0;

    // Audit log for OTP requirement
    // Removed audit log call

    return {
      success: true,
      nextStep: 'otp_required',
      requiresOtp: true,
      userId: user.id.getValue(),
      message: '2FA verification required',
    };
  }

  /**
   * Log successful authentication
   */
  private async logSuccessfulAuth(
    user: User,
    email: string,
    userAgent?: string,
    ipAddress?: string,
    startTime?: number,
  ): Promise<void> {
    const _duration = startTime ? performance.now() - startTime : 0;

    this.logger.log({
      message: 'Login successful',
      userId: user.id.getValue(),
      email,
      roles: user.rolesCollection?.roles?.map(r => r.name) || [],
    });

    // Audit log for successful authentication
    // Removed audit log call
  }

  /**
   * Handle BOT login - returns existing active token instead of creating new session
   */
  private async handleBotLogin(
    user: User,
    email: string,
    userAgent?: string,
    ipAddress?: string,
    startTime?: number,
  ): Promise<ILoginFlowResult> {
    const duration = startTime ? performance.now() - startTime : 0;

    this.logger.debug({
      message: 'Processing BOT login',
      userId: user.id.getValue(),
      email,
      alias: user.alias,
    });

    // Find active BOT token for this user
    const activeBotTokens = await this.botTokenRepository.findAllActive();
    const userActiveBotToken = activeBotTokens.find(
      token => token.botUserId.getValue() === user.id.getValue(),
    );

    if (!userActiveBotToken) {
      // No active BOT token found - this shouldn't happen for valid BOT users
      this.logger.warn({
        message: 'BOT user has no active token',
        userId: user.id.getValue(),
        email,
        alias: user.alias,
      });

      return this.buildFailureResult(
        email,
        AuthFailureReason.BOT_NO_ACTIVE_TOKEN,
        {
          success: false,
          failureReason: AuthFailureReason.BOT_NO_ACTIVE_TOKEN,
          message: 'BOT user has no active token',
        },
        userAgent,
        ipAddress,
        startTime,
        user.id,
      );
    }

    // Get permissions for the BOT user
    const permissions = await this.permissionCollectionService.collectUserPermissions(user);

    // Create auth response with existing BOT token
    const authResponse: AuthResponse = {
      accessToken: userActiveBotToken.tokenId, // BOT token ID is the access token
      refreshToken: '', // BOTs don't use refresh tokens
      user: UserMapper.toAuthResponse(user),
    };

    // Convert Set to array for the response
    const userResponse = authResponse.user as unknown as Record<string, unknown>;
    userResponse.permissions = Array.from(permissions);

    // Log successful BOT authentication
    this.logger.log({
      message: 'BOT login successful - returned existing token',
      userId: user.id.getValue(),
      email,
      alias: user.alias,
      tokenId: userActiveBotToken.tokenId.substring(0, 8) + '***',
      duration,
    });

    // Audit log for BOT authentication
    // Removed audit log call

    return {
      success: true,
      nextStep: 'complete',
      authResponse,
      auditDetails: {
        email,
        userAgent,
        ipAddress,
        duration,
      },
    };
  }
}
