import { ICommand, CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable, Inject, Optional, ConflictException } from '@nestjs/common';
import { CompanyId } from '@core/value-objects/company-id.vo';
import { CompanyService } from '@core/services/company.service';
import { IUserRepository } from '@core/repositories/user.repository.interface';
import { AuditLogService } from '@core/services/audit-log.service';
import { UserActivityLogService } from '@core/services/user-activity-log.service';
import { REPOSITORY_TOKENS, LOGGER_SERVICE } from '@shared/constants/tokens';
import { ILogger } from '@core/interfaces/logger.interface';
import { IReactivateCompanyResponse } from '@application/dtos/_responses/company/reactivate-company.response';
import {
  BusinessRuleValidationException,
  EntityNotFoundException,
} from '@core/exceptions/domain-exceptions';
import { UserAuthorizationService } from '@core/services/user-authorization.service';
import { RolesEnum } from '@shared/constants/enums';

export class ReactivateCompanyCommand implements ICommand {
  constructor(
    public readonly companyId: CompanyId,
    public readonly adminUserId: string,
    public readonly adminUserEmail: string,
    public readonly ipAddress?: string,
    public readonly userAgent?: string,
  ) {}
}

@Injectable()
@CommandHandler(ReactivateCompanyCommand)
export class ReactivateCompanyCommandHandler implements ICommandHandler<ReactivateCompanyCommand> {
  private readonly logger: ILogger;

  constructor(
    private readonly companyService: CompanyService,
    @Inject(REPOSITORY_TOKENS.USER_REPOSITORY)
    private readonly userRepository: IUserRepository,
    private readonly auditLogService: AuditLogService,
    private readonly userActivityLogService: UserActivityLogService,
    private readonly userAuthorizationService: UserAuthorizationService,
    @Optional() @Inject(LOGGER_SERVICE) logger?: ILogger,
  ) {
    this.logger = logger?.setContext(ReactivateCompanyCommandHandler.name);
  }

  async execute(command: ReactivateCompanyCommand): Promise<IReactivateCompanyResponse> {
    const { companyId, adminUserId, adminUserEmail, ipAddress, userAgent } = command;

    try {
      const adminUser = await this.userAuthorizationService.getCurrentUserSafely(adminUserId);

      if (
        !this.userAuthorizationService.canAccessRootFeatures(adminUser) ||
        !adminUser.roles ||
        !adminUser.roles.some(r => r.name === RolesEnum.ROOT) ||
        !this.userAuthorizationService.canAccessCompany(adminUser, companyId.getValue())
      ) {
        throw new BusinessRuleValidationException('Only root users can reactivate companies');
      }

      // 1. Verificar que la empresa existe y está inactiva
      const company = await this.companyService.getCompanyById(companyId);
      if (!company) {
        throw new EntityNotFoundException('Company', companyId.getValue());
      }

      if (company.isActive) {
        throw new ConflictException(`Company is already active`);
      }

      // 2. Obtener todos los usuarios de la empresa
      const companyUsers = await this.userRepository.findAllByCompanyId(companyId.getValue());
      // Solo reactivar usuarios inactivos que sean reactivables (no baneados)
      const reactivableUsers = companyUsers.filter(user => !user.isActive && user.isReactivable);

      // 3. Reactivar la empresa
      const _reactivatedCompany = await this.companyService.reactivateCompany(companyId, adminUser);
      const reactivatedAt = new Date();

      // 4. Reactivar todos los usuarios reactivables de la empresa
      let reactivatedUsersCount = 0;
      for (const user of reactivableUsers) {
        // Reactivar usuario
        user.activate(adminUser);
        await this.userRepository.update(user);
        reactivatedUsersCount++;

        // Registrar actividad del usuario
        await this.userActivityLogService.logUserReactivatedByCompany(
          user.id.getValue(),
          'company_reactivation',
          `User reactivated due to company reactivation by administrator`,
          {
            companyId: companyId.getValue(),
            companyName: company.name.getValue(),
            reactivatedBy: adminUserId,
            reactivatedByEmail: adminUserEmail,
            reactivatedAt: reactivatedAt.toISOString(),
          },
          ipAddress,
          userAgent,
        );
      }

      // 5. Registrar en audit log
      await this.auditLogService.logCompanyReactivation(
        adminUserId,
        companyId.getValue(),
        company.name.getValue(),
        {
          companyId: companyId.getValue(),
          companyName: company.name.getValue(),
          reactivatedUsersCount,
          reactivatedBy: adminUserId,
          reactivatedByEmail: adminUserEmail,
          reactivatedAt: reactivatedAt.toISOString(),
          action: 'company_reactivation',
          ipAddress,
          userAgent,
        },
      );

      this.logger?.log(
        `Company ${company.name.getValue()} (${companyId.getValue()}) reactivated by admin ${adminUserEmail}. ${reactivatedUsersCount} users reactivated.`,
      );

      return {
        success: true,
        message: `Company "${company.name.getValue()}" has been successfully reactivated. ${reactivatedUsersCount} users were reactivated.`,
        companyId: companyId.getValue(),
        companyName: company.name.getValue(),
        reactivatedAt,
        reactivatedBy: adminUserEmail,
        reactivatedUsersCount,
      };
    } catch (error) {
      this.logger?.error(
        `Failed to reactivate company ${companyId.getValue()}: ${error.message}`,
        error.stack,
        ReactivateCompanyCommandHandler.name,
      );

      // Registrar error en audit log
      await this.auditLogService.logSystemError(
        adminUserId,
        'company_reactivation_failed',
        `Failed to reactivate company ${companyId.getValue()}: ${error.message}`,
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
