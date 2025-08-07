import { Injectable, Inject } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AuditLogService } from './audit-log.service';
import { AUDIT_LOG_SERVICE, LOGGER_SERVICE } from '@shared/constants/tokens';
import { ILogger } from '@core/interfaces/logger.interface';

/**
 * Servicio automático de limpieza de audit logs
 *
 * **Propósito**: Servicio especializado en implementar y ejecutar automáticamente
 * la política de retención de 7 días para audit logs como fue solicitado.
 *
 * **Responsabilidades**:
 * - Ejecuta limpieza automática diaria a las 2:00 AM
 * - Implementa política estricta de retención de 7 días
 * - Proporciona método manual para limpieza de emergencia
 * - Logging detallado de operaciones de limpieza
 * - Manejo robusto de errores sin afectar sistema principal
 *
 * **Arquitectura de scheduling**:
 * - Usa @nestjs/schedule para cron jobs
 * - Cron expression: EVERY_DAY_AT_2AM
 * - Execution en background sin bloquear aplicación
 * - Error handling que no interrumpe scheduling
 *
 * **Políticas implementadas**:
 * - **Retención**: Exactamente 7 días como solicitado
 * - **Frecuencia**: Limpieza diaria automatizada
 * - **Logging**: Registro completo de operaciones
 * - **Resilencia**: Continúa funcionando ante errores
 *
 * **Beneficios**:
 * - Previene crecimiento descontrolado de BD
 * - Cumple políticas de retención de datos
 * - Mantiene performance de queries
 * - Automatización completa sin intervención manual
 * - Monitoreo y observabilidad integrados
 *
 * @example
 * ```typescript
 * // Limpieza se ejecuta automáticamente, pero puede dispararse manualmente:
 * const deletedCount = await this.cleanupService.performManualCleanup();
 * console.log(`Cleaned ${deletedCount} old audit logs`);
 * ```
 *
 * **Integración con sistema**:
 * - Registrado como scheduled service en app module
 * - Delega operaciones a AuditLogService
 * - Logging via sistema centralizado de logs
 * - Configuración via environment variables
 */
@Injectable()
export class AuditLogCleanupService {
  constructor(
    @Inject(AUDIT_LOG_SERVICE)
    private readonly auditLogService: AuditLogService,
    @Inject(LOGGER_SERVICE)
    private readonly logger: ILogger,
  ) {
    this.logger.setContext(AuditLogCleanupService.name);
  }

  /**
   * Automatic cleanup job - runs daily at 2:00 AM
   * Enforces 7-day retention policy as requested
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async performDailyCleanup(): Promise<void> {
    try {
      this.logger.log({ message: 'Starting automatic audit log cleanup (7-day retention)' });

      const deletedCount = await this.auditLogService.performAutomaticCleanup();

      this.logger.log({
        message: 'Automatic audit log cleanup completed successfully',
        deletedCount,
        retentionDays: 7,
      });
    } catch (error) {
      this.logger.error({
        message: 'Failed to perform automatic audit log cleanup',
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  }

  /**
   * Manual cleanup trigger (for testing or emergency cleanup)
   */
  async performManualCleanup(): Promise<number> {
    this.logger.log({ message: 'Starting manual audit log cleanup (7-day retention)' });

    try {
      const deletedCount = await this.auditLogService.performAutomaticCleanup();

      this.logger.log({
        message: 'Manual audit log cleanup completed successfully',
        deletedCount,
        retentionDays: 7,
      });

      return deletedCount;
    } catch (error) {
      this.logger.error({
        message: 'Failed to perform manual audit log cleanup',
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }
}
