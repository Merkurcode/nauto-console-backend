import { Module } from '@nestjs/common';
import { DomainEventService } from './services/domain-event.service';
import { DomainValidationService } from './services/domain-validation.service';
import { UserAuthorizationService } from './services/user-authorization.service';
import { SessionService } from './services/session.service';
import { UserBanService } from './services/user-ban.service';
import { ApplicationEventService } from './services/application-event.service';
import { HealthService } from './services/health.service';
import { LoggerModule } from '@infrastructure/logger/logger.module';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '@infrastructure/database/prisma/prisma.module';
import { SESSION_REPOSITORY, USER_REPOSITORY } from '@shared/constants/tokens';
import { SessionRepository } from '@infrastructure/repositories/session.repository';
import { UserRepository } from '@infrastructure/repositories/user.repository';

/**
 * Core Domain Module
 * Contains all domain services and DDD infrastructure
 */
@Module({
  imports: [LoggerModule, ConfigModule, PrismaModule],
  providers: [
    DomainEventService,
    DomainValidationService,
    UserAuthorizationService,
    SessionService,
    UserBanService,
    ApplicationEventService,
    HealthService,
    {
      provide: SESSION_REPOSITORY,
      useClass: SessionRepository,
    },
    {
      provide: USER_REPOSITORY,
      useClass: UserRepository,
    },
  ],
  exports: [
    DomainEventService,
    DomainValidationService,
    UserAuthorizationService,
    SessionService,
    UserBanService,
    ApplicationEventService,
    HealthService,
  ],
})
export class CoreModule {}
