import { Injectable, Inject } from '@nestjs/common';
import { AuditLogService } from './audit-log.service';
import { UserId } from '@core/value-objects/user-id.vo';
import { ITransactionManager } from '@core/interfaces/transaction-manager.interface';
import { TRANSACTION_MANAGER, LOGGER_SERVICE, AUDIT_LOG_SERVICE } from '@shared/constants/tokens';
import { ILogger } from '@core/interfaces/logger.interface';
import { AuditLogAction } from '@core/entities/audit-log.entity';

/**
 * Domain service that orchestrates transactions with audit logging
 * Following Clean Architecture principles - domain layer
 */
@Injectable()
export class AuditTransactionService {
  constructor(
    @Inject(TRANSACTION_MANAGER)
    private readonly transactionManager: ITransactionManager,
    @Inject(AUDIT_LOG_SERVICE)
    private readonly auditLogService: AuditLogService,
    @Inject(LOGGER_SERVICE)
    private readonly logger: ILogger,
  ) {
    this.logger.setContext(AuditTransactionService.name);
  }

  /**
   * Universal method for executing operations with automatic audit logging
   * Audit logs are saved independently of transaction outcome
   */
  async execute<T>(
    operation: () => Promise<T>,
    context: {
      action: AuditLogAction;
      resource: string;
      resourceId?: string;
      userId?: UserId;
      metadata?: Record<string, unknown>;
    },
  ): Promise<T> {
    const startTime = Date.now();
    const { action, resource, resourceId, userId, metadata = {} } = context;

    try {
      // Execute within transaction
      const result = await this.transactionManager.executeInTransaction(operation);

      // Log success (outside transaction)
      this.auditLogService.logApi(
        action,
        `${action} ${resource}${resourceId ? ` (${resourceId})` : ''} succeeded`,
        userId || null,
        undefined,
        undefined,
        Date.now() - startTime,
        'info',
      );

      return result;
    } catch (error) {
      // Log failure (outside transaction)
      this.auditLogService.logSecurity(
        action,
        `${action} ${resource}${resourceId ? ` (${resourceId})` : ''} failed`,
        userId || null,
        undefined,
        {
          ...metadata,
          error: error instanceof Error ? error.message : String(error),
          duration: Date.now() - startTime,
        },
        'error',
      );

      throw error;
    }
  }
}
