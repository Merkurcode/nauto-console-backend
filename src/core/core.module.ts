import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
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

/**
 * Core Domain Module
 * Contains ONLY domain services with pure business logic
 * No infrastructure dependencies - those are injected via tokens
 */
@Module({
  imports: [ConfigModule, forwardRef(() => InfrastructureModule)],
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
  ],
})
export class CoreModule {}
