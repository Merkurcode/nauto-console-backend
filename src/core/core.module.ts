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
import { AuthenticationValidationService } from './services/authentication-validation.service';
import { BotSessionValidationService } from './services/bot-session-validation.service';
import { TenantResolverService } from './services/tenant-resolver.service';
import { CompanyService } from './services/company.service';
import { RoleService } from './services/role.service';
import { PermissionService } from './services/permission.service';
import { AIAssistantService } from './services/ai-assistant.service';
import { AIPersonaService } from './services/ai-persona.service';
import { CompanyScheduleService } from './services/company-schedule.service';
import { PermissionExcludeService } from './services/permission-exclude.service';
import { UserStorageConfigService } from './services/user-storage-config.service';
import { StorageTiersService } from './services/storage-tiers.service';
import { AuditLogService } from './services/audit-log.service';
import { UserActivityLogService } from './services/user-activity-log.service';
import { FileAccessControlService } from './services/file-access-control.service';
import { FileLockService } from './services/file-lock.service';
import { FolderLockService } from './services/folder-lock.service';
import { FileQuotaService } from './services/file-quota.service';
import { FileUploadValidationService } from './services/file-upload-validation.service';
import { MultipartUploadService } from './services/multipart-upload.service';
import { FileNamingService } from './services/file-naming.service';
import { MarketingCampaignService } from './services/marketing-campaign.service';
import { ExcelStreamingService } from './services/excel-streaming.service';
import { FileDownloadStreamingService } from './services/file-download-streaming.service';
import { BulkProcessingService } from './services/bulk-processing.service';

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
    AuthenticationValidationService,
    BotSessionValidationService,
    TenantResolverService,
    // Domain services for Clean Architecture
    CompanyService,
    RoleService,
    PermissionService,
    AIAssistantService,
    AIPersonaService,
    CompanyScheduleService,
    PermissionExcludeService,
    UserStorageConfigService,
    StorageTiersService,
    // Additional domain services
    AuditLogService,
    UserActivityLogService,
    FileAccessControlService,
    FileLockService,
    FolderLockService,
    FileQuotaService,
    FileUploadValidationService,
    MultipartUploadService,
    FileNamingService,
    MarketingCampaignService,
    ExcelStreamingService,
    FileDownloadStreamingService,
    BulkProcessingService,
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
    AuthenticationValidationService,
    BotSessionValidationService,
    TenantResolverService,
    // Domain services for Clean Architecture
    CompanyService,
    RoleService,
    PermissionService,
    AIAssistantService,
    AIPersonaService,
    CompanyScheduleService,
    PermissionExcludeService,
    UserStorageConfigService,
    StorageTiersService,
    // Additional domain services
    AuditLogService,
    UserActivityLogService,
    FileAccessControlService,
    FileLockService,
    FolderLockService,
    FileQuotaService,
    FileUploadValidationService,
    MultipartUploadService,
    FileNamingService,
    MarketingCampaignService,
    ExcelStreamingService,
    FileDownloadStreamingService,
    BulkProcessingService,
  ],
})
export class CoreModule {}
