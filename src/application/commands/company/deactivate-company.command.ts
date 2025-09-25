import { ICommand, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable, Inject, Optional, ConflictException } from '@nestjs/common';
import { CompanyId } from '@core/value-objects/company-id.vo';
import { CompanyService } from '@core/services/company.service';
import { IUserRepository } from '@core/repositories/user.repository.interface';
import { AuditLogService } from '@core/services/audit-log.service';
import { UserActivityLogService } from '@core/services/user-activity-log.service';
import { REPOSITORY_TOKENS, LOGGER_SERVICE } from '@shared/constants/tokens';
import { ILogger } from '@core/interfaces/logger.interface';
import { IDeactivateCompanyResponse } from '@application/dtos/_responses/company/deactivate-company.response';
import {
  BusinessRuleValidationException,
  EntityNotFoundException,
} from '@core/exceptions/domain-exceptions';
import { AuthService } from '@core/services/auth.service';
import { SessionService } from '@core/services/session.service';
import { UserAuthorizationService } from '@core/services/user-authorization.service';
import { RolesEnum } from '@shared/constants/enums';

export class DeactivateCompanyCommand implements ICommand {
  constructor(
    public readonly companyId: CompanyId,
    public readonly adminUserId: string,
    public readonly adminUserEmail: string,
    public readonly ipAddress?: string,
    public readonly userAgent?: string,
  ) {}
}

@Injectable()
@CommandHandler(DeactivateCompanyCommand)
export class DeactivateCompanyCommandHandler implements ICommandHandler<DeactivateCompanyCommand> {
  private readonly logger: ILogger;

  constructor(
    private readonly companyService: CompanyService,
    @Inject(REPOSITORY_TOKENS.USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    private readonly auditLogService: AuditLogService,
    private readonly userActivityLogService: UserActivityLogService,
    private readonly authService: AuthService,
    private readonly sessionService: SessionService,
    private readonly userAuthorizationService: UserAuthorizationService,
    @Optional() @Inject(LOGGER_SERVICE) logger?: ILogger,
  ) {
    this.logger = logger?.setContext(DeactivateCompanyCommandHandler.name);
  }

  async execute(command: DeactivateCompanyCommand): Promise<IDeactivateCompanyResponse> {
    const { companyId, adminUserId, adminUserEmail, ipAddress, userAgent } = command;

    try {
      const adminUser = await this.userAuthorizationService.getCurrentUserSafely(adminUserId);

      if (
        !this.userAuthorizationService.canAccessRootFeatures(adminUser) ||
        !adminUser.roles ||
        !adminUser.roles.some(r => r.name === RolesEnum.ROOT) ||
        !this.userAuthorizationService.canAccessCompany(adminUser, companyId.getValue())
      ) {
        throw new BusinessRuleValidationException('Only root users can deactivate companies');
      }

      // 1. Verificar que la empresa existe y está activa
      const company = await this.companyService.getCompanyById(companyId);
      if (!company) {
        throw new EntityNotFoundException('Company', companyId.getValue());
      }

      if (!company.isActive) {
        throw new ConflictException(`Company is already deactivated at ${company.updatedAt}`);
      }

      // 2. Obtener todos los usuarios de la empresa
      const companyUsers = await this.userRepository.findAllByCompanyId(companyId.getValue());
      // Solo desactivar usuarios activos y que sean reactivables (no baneados)
      const activeUsers = companyUsers.filter(user => user.isActive && user.isReactivable);

      // 3. Desactivar la empresa
      const _deactivatedCompany = await this.companyService.deactivateCompany(companyId, adminUser);
      const deactivatedAt = new Date();

      // 4. Desactivar todos los usuarios de la empresa y registrar actividad
      let terminatedSessionsCount = 0;
      for (const user of activeUsers) {
        // Desactivar usuario
        user.deactivate(adminUser);
        await this.userRepository.update(user);

        // Global logout - revoke all sessions for the user
        terminatedSessionsCount += await this.sessionService.revokeUserSessions(
          user.id.getValue(),
          'global',
        );
        // Also revoke all refresh tokens as a backup
        await this.authService.revokeAllRefreshTokens(user.id.getValue());

        // Registrar actividad del usuario
        await this.userActivityLogService.logUserDeactivatedByCompany(
          user.id.getValue(),
          'company_deactivation',
          `User deactivated due to company deactivation by administrator`,
          {
            companyId: companyId.getValue(),
            companyName: company.name.getValue(),
            deactivatedBy: adminUserId,
            deactivatedByEmail: adminUserEmail,
            deactivatedAt: deactivatedAt.toISOString(),
          },
          ipAddress,
          userAgent,
        );
      }

      // 5. Registrar en audit log
      await this.auditLogService.logCompanyDeactivation(
        adminUserId,
        companyId.getValue(),
        company.name.getValue(),
        {
          companyId: companyId.getValue(),
          companyName: company.name.getValue(),
          affectedUsersCount: activeUsers.length,
          terminatedSessionsCount,
          deactivatedBy: adminUserId,
          deactivatedByEmail: adminUserEmail,
          deactivatedAt: deactivatedAt.toISOString(),
          action: 'company_deactivation',
          ipAddress,
          userAgent,
        },
      );

      this.logger?.log(
        `Company ${company.name.getValue()} (${companyId.getValue()}) deactivated by admin ${adminUserEmail}. ${activeUsers.length} users affected.`,
      );

      return {
        success: true,
        message: `Company "${company.name.getValue()}" has been successfully deactivated. ${activeUsers.length} user sessions terminated.`,
        companyId: companyId.getValue(),
        companyName: company.name.getValue(),
        deactivatedAt,
        deactivatedBy: adminUserEmail,
        affectedUsersCount: activeUsers.length,
        terminatedSessionsCount,
      };
    } catch (error) {
      this.logger?.error(
        `Failed to deactivate company ${companyId.getValue()}: ${error.message}`,
        error.stack,
        DeactivateCompanyCommandHandler.name,
      );

      // Registrar error en audit log
      await this.auditLogService.logSystemError(
        adminUserId,
        'company_deactivation_failed',
        `Failed to deactivate company ${companyId.getValue()}: ${error.message}`,
        {
          companyId: companyId.getValue(),
          error: error.message,
          stack: error.stack,
          adminUserId,
          adminUserEmail,
        },
      );

      throw error;
    }
  }
}
