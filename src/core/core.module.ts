import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import { InfrastructureModule } from '@infrastructure/infrastructure.module';

// Domain Services - Pure business logic
import { DomainEventService } from './services/domain-event.service';
import { DomainValidationService } from './services/domain-validation.service';
import { UserAuthorizationService } from './services/user-authorization.service';
import { UserAccessAuthorizationService } from './services/user-access-authorization.service';
import { SessionService } from './services/session.service';
import { UserBanService } from './services/user-ban.service';
import { ApplicationEventService } from './services/application-event.service';
import { HealthService } from './services/health.service';
import { EmailService } from './services/email.service';
import { SmsService } from './services/sms.service';
import { AuthService } from './services/auth.service';
import { UserService } from './services/user.service';
import { SessionValidationService } from './services/session-validation.service';
import { ScheduleValidationService } from './services/schedule-validation.service';
import { UserDeletionPolicyService } from './services/user-deletion-policy.service';
import { PermissionCollectionService } from './services/permission-collection.service';
import { RequestContextService } from './services/request-context.service';
import { BusinessConfigurationService } from './services/business-configuration.service';
import { AuditLogService } from './services/audit-log.service';
import { AuditLogQueueService } from './services/audit-log-queue.service';
import { AuditLogCleanupService } from './services/audit-log-cleanup.service';
import { AuditTransactionService } from './services/audit-transaction.service';
import { AuthenticationValidationService } from './services/authentication-validation.service';
import { AUDIT_LOG_SERVICE } from '@shared/constants/tokens';

/**
 * Core Domain Module
 * Contains ONLY domain services with pure business logic
 * No infrastructure dependencies - those are injected via tokens
 */
@Module({
  imports: [ConfigModule, CqrsModule, forwardRef(() => InfrastructureModule)],
  providers: [
    // Pure domain services
    DomainEventService,
    DomainValidationService,
    UserAuthorizationService,
    UserAccessAuthorizationService,
    SessionService,
    UserBanService,
    ApplicationEventService,
    HealthService,
    EmailService,
    SmsService,
    AuthService,
    UserService,
    // New domain services for Clean Architecture compliance
    SessionValidationService,
    ScheduleValidationService,
    UserDeletionPolicyService,
    PermissionCollectionService,
    RequestContextService,
    BusinessConfigurationService,
    // Audit logging services
    {
      provide: AUDIT_LOG_SERVICE,
      useClass: AuditLogService,
    },
    AuditLogQueueService,
    AuditLogCleanupService,
    AuditTransactionService,
    AuthenticationValidationService,
  ],
  exports: [
    // Export all domain services
    DomainEventService,
    DomainValidationService,
    UserAuthorizationService,
    UserAccessAuthorizationService,
    SessionService,
    UserBanService,
    ApplicationEventService,
    HealthService,
    EmailService,
    SmsService,
    AuthService,
    UserService,
    // New domain services for Clean Architecture compliance
    SessionValidationService,
    ScheduleValidationService,
    UserDeletionPolicyService,
    PermissionCollectionService,
    RequestContextService,
    BusinessConfigurationService,
    // Audit logging services
    AUDIT_LOG_SERVICE,
    AuditLogQueueService,
    AuditLogCleanupService,
    AuditTransactionService,
    AuthenticationValidationService,
  ],
})
export class CoreModule {}
