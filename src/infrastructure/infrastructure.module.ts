import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ILogger } from '@core/interfaces/logger.interface';
import { CoreModule } from '@core/core.module';
import { LoggerModule } from './logger/logger.module';
import { PrismaModule } from './database/prisma/prisma.module';
import { PrismaService } from './database/prisma/prisma.service';
import { TransactionContextService } from './database/prisma/transaction-context.service';
import { TransactionService } from './database/prisma/transaction.service';
import { TransactionManagerAdapter } from './database/prisma/transaction-manager.adapter';
import { DatabaseHealthProvider } from './database/database-health.provider';
import { RequestCacheService } from './caching/request-cache.service';

// Repository implementations
import { SessionRepository } from './repositories/session.repository';
import { UserRepository } from './repositories/user.repository';
import { CompanyRepository } from './repositories/company.repository';
import { RoleRepository } from './repositories/role.repository';
import { OtpRepository } from './repositories/otp.repository';
import { RefreshTokenRepository } from './repositories/refresh-token.repository';
import { EmailVerificationRepository } from './repositories/email-verification.repository';
import { PasswordResetRepository } from './repositories/password-reset.repository';
import { PasswordResetAttemptRepository } from './repositories/password-reset-attempt.repository';
import { CountryRepository } from './repositories/country.repository';
import { StateRepository } from './repositories/state.repository';
import { PermissionRepository } from './repositories/permission.repository';
import { AIAssistantRepository } from './repositories/ai-assistant.repository';
import { AIPersonaRepository } from './repositories/ai-persona.repository';
import { CompanyAIPersonaRepository } from './repositories/company-ai-persona.repository';
import { CompanyAIAssistantRepository } from './repositories/company-ai-assistant.repository';
import { CompanySchedulesRepository } from './repositories/company-schedules.repository';
import { AuditLogRepository } from './repositories/audit-log.repository';
import { BotTokenRepository } from './repositories/bot-token.repository';
import { UserStorageConfigRepository } from './repositories/user-storage-config.repository';
import { StorageTiersRepository } from './repositories/storage-tiers.repository';
import { UserActivityLogRepository } from './repositories/user-activity-log.repository';
import { TokenProvider } from './auth/token.provider';

// Tokens
import {
  SESSION_REPOSITORY,
  USER_REPOSITORY,
  COMPANY_REPOSITORY,
  ROLE_REPOSITORY,
  PERMISSION_REPOSITORY,
  OTP_REPOSITORY,
  REFRESH_TOKEN_REPOSITORY,
  EMAIL_VERIFICATION_REPOSITORY,
  PASSWORD_RESET_REPOSITORY,
  PASSWORD_RESET_ATTEMPT_REPOSITORY,
  COUNTRY_REPOSITORY,
  STATE_REPOSITORY,
  AI_ASSISTANT_REPOSITORY,
  AI_PERSONA_REPOSITORY,
  COMPANY_AI_PERSONA_REPOSITORY,
  COMPANY_AI_ASSISTANT_REPOSITORY,
  COMPANY_SCHEDULES_REPOSITORY,
  AUDIT_LOG_REPOSITORY,
  BOT_TOKEN_REPOSITORY,
  USER_STORAGE_CONFIG_REPOSITORY,
  STORAGE_TIERS_REPOSITORY,
  USER_ACTIVITY_LOG_REPOSITORY,
  DATABASE_HEALTH,
  TOKEN_PROVIDER,
  TRANSACTION_MANAGER,
  LOGGER_SERVICE,
} from '@shared/constants/tokens';

/**
 * Infrastructure Module
 * Provides all infrastructure implementations and external dependencies
 * This module bridges the gap between domain interfaces and concrete implementations
 */
@Module({
  imports: [
    LoggerModule,
    ConfigModule,
    PrismaModule,
    forwardRef(() => CoreModule),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.secret'),
        signOptions: {
          expiresIn: configService.get<string>('jwt.accessExpiration'),
          algorithm: configService.get('jwt.algorithm', 'HS512'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    // Repository providers
    {
      provide: SESSION_REPOSITORY,
      useFactory: (
        prisma: PrismaService,
        transactionContext: TransactionContextService,
        logger: ILogger,
        requestCache: RequestCacheService,
      ) => new SessionRepository(prisma, transactionContext, logger, requestCache),
      inject: [PrismaService, TransactionContextService, LOGGER_SERVICE, RequestCacheService],
    },
    {
      provide: USER_REPOSITORY,
      useFactory: (
        prisma: PrismaService,
        transactionContext: TransactionContextService,
        logger: ILogger,
        requestCache: RequestCacheService,
      ) => new UserRepository(prisma, transactionContext, logger, requestCache),
      inject: [PrismaService, TransactionContextService, LOGGER_SERVICE, RequestCacheService],
    },
    {
      provide: COMPANY_REPOSITORY,
      useFactory: (
        prisma: PrismaService,
        transactionContext: TransactionContextService,
        logger: ILogger,
      ) => new CompanyRepository(prisma, transactionContext, logger),
      inject: [PrismaService, TransactionContextService, LOGGER_SERVICE],
    },
    {
      provide: ROLE_REPOSITORY,
      useFactory: (
        prisma: PrismaService,
        transactionContext: TransactionContextService,
        logger: ILogger,
      ) => new RoleRepository(prisma, transactionContext, logger),
      inject: [PrismaService, TransactionContextService, LOGGER_SERVICE],
    },
    {
      provide: PERMISSION_REPOSITORY,
      useFactory: (
        prisma: PrismaService,
        transactionContext: TransactionContextService,
        logger: ILogger,
      ) => new PermissionRepository(prisma, transactionContext, logger),
      inject: [PrismaService, TransactionContextService, LOGGER_SERVICE],
    },
    {
      provide: OTP_REPOSITORY,
      useFactory: (
        prisma: PrismaService,
        transactionContext: TransactionContextService,
        configService: ConfigService,
        logger: ILogger,
      ) => new OtpRepository(prisma, transactionContext, configService, logger),
      inject: [PrismaService, TransactionContextService, ConfigService, LOGGER_SERVICE],
    },
    {
      provide: REFRESH_TOKEN_REPOSITORY,
      useFactory: (
        prisma: PrismaService,
        transactionContext: TransactionContextService,
        configService: ConfigService,
        logger: ILogger,
      ) => new RefreshTokenRepository(prisma, transactionContext, configService, logger),
      inject: [PrismaService, TransactionContextService, ConfigService, LOGGER_SERVICE],
    },
    {
      provide: EMAIL_VERIFICATION_REPOSITORY,
      useFactory: (
        prisma: PrismaService,
        transactionContext: TransactionContextService,
        logger: ILogger,
      ) => new EmailVerificationRepository(prisma, transactionContext, logger),
      inject: [PrismaService, TransactionContextService, LOGGER_SERVICE],
    },
    {
      provide: PASSWORD_RESET_REPOSITORY,
      useFactory: (
        prisma: PrismaService,
        transactionContext: TransactionContextService,
        logger: ILogger,
      ) => new PasswordResetRepository(prisma, transactionContext, logger),
      inject: [PrismaService, TransactionContextService, LOGGER_SERVICE],
    },
    {
      provide: PASSWORD_RESET_ATTEMPT_REPOSITORY,
      useFactory: (
        prisma: PrismaService,
        transactionContext: TransactionContextService,
        logger: ILogger,
      ) => new PasswordResetAttemptRepository(prisma, transactionContext, logger),
      inject: [PrismaService, TransactionContextService, LOGGER_SERVICE],
    },
    {
      provide: COUNTRY_REPOSITORY,
      useFactory: (
        prisma: PrismaService,
        transactionContext: TransactionContextService,
        logger: ILogger,
      ) => new CountryRepository(prisma, transactionContext, logger),
      inject: [PrismaService, TransactionContextService, LOGGER_SERVICE],
    },
    {
      provide: STATE_REPOSITORY,
      useFactory: (
        prisma: PrismaService,
        transactionContext: TransactionContextService,
        logger: ILogger,
      ) => new StateRepository(prisma, transactionContext, logger),
      inject: [PrismaService, TransactionContextService, LOGGER_SERVICE],
    },
    {
      provide: AI_ASSISTANT_REPOSITORY,
      useFactory: (
        prisma: PrismaService,
        transactionContext: TransactionContextService,
        logger: ILogger,
      ) => new AIAssistantRepository(prisma, transactionContext, logger),
      inject: [PrismaService, TransactionContextService, LOGGER_SERVICE],
    },
    {
      provide: AI_PERSONA_REPOSITORY,
      useFactory: (prisma: PrismaService, transactionContext: TransactionContextService) =>
        new AIPersonaRepository(prisma, transactionContext),
      inject: [PrismaService, TransactionContextService],
    },
    {
      provide: COMPANY_AI_PERSONA_REPOSITORY,
      useFactory: (prisma: PrismaService, transactionContext: TransactionContextService) =>
        new CompanyAIPersonaRepository(prisma, transactionContext),
      inject: [PrismaService, TransactionContextService],
    },
    {
      provide: COMPANY_AI_ASSISTANT_REPOSITORY,
      useFactory: (
        prisma: PrismaService,
        transactionContext: TransactionContextService,
        logger: ILogger,
      ) => new CompanyAIAssistantRepository(prisma, transactionContext, logger),
      inject: [PrismaService, TransactionContextService, LOGGER_SERVICE],
    },
    {
      provide: COMPANY_SCHEDULES_REPOSITORY,
      useFactory: (
        prisma: PrismaService,
        transactionContext: TransactionContextService,
        logger: ILogger,
      ) => new CompanySchedulesRepository(prisma, transactionContext, logger),
      inject: [PrismaService, TransactionContextService, LOGGER_SERVICE],
    },
    {
      provide: AUDIT_LOG_REPOSITORY,
      useFactory: (
        prisma: PrismaService,
        transactionContext: TransactionContextService,
        logger: ILogger,
      ) => new AuditLogRepository(prisma, transactionContext, logger),
      inject: [PrismaService, TransactionContextService, LOGGER_SERVICE],
    },
    {
      provide: BOT_TOKEN_REPOSITORY,
      useFactory: (
        prisma: PrismaService,
        transactionContext: TransactionContextService,
        logger: ILogger,
      ) => new BotTokenRepository(prisma, transactionContext, logger),
      inject: [PrismaService, TransactionContextService, LOGGER_SERVICE],
    },
    {
      provide: USER_STORAGE_CONFIG_REPOSITORY,
      useFactory: (
        prisma: PrismaService,
        transactionContext: TransactionContextService,
        logger: ILogger,
      ) => new UserStorageConfigRepository(prisma, transactionContext, logger),
      inject: [PrismaService, TransactionContextService, LOGGER_SERVICE],
    },
    {
      provide: STORAGE_TIERS_REPOSITORY,
      useFactory: (
        prisma: PrismaService,
        transactionContext: TransactionContextService,
        logger: ILogger,
      ) => new StorageTiersRepository(prisma, transactionContext, logger),
      inject: [PrismaService, TransactionContextService, LOGGER_SERVICE],
    },
    {
      provide: USER_ACTIVITY_LOG_REPOSITORY,
      useFactory: (prisma: PrismaService, logger: ILogger) =>
        new UserActivityLogRepository(prisma, logger),
      inject: [PrismaService, TransactionContextService, LOGGER_SERVICE],
    },

    // Infrastructure services
    RequestCacheService,
    {
      provide: DATABASE_HEALTH,
      useFactory: (prisma: PrismaService) => new DatabaseHealthProvider(prisma),
      inject: [PrismaService],
    },
    {
      provide: TOKEN_PROVIDER,
      useClass: TokenProvider,
    },
    {
      provide: TRANSACTION_MANAGER,
      useFactory: (transactionService: TransactionService) =>
        new TransactionManagerAdapter(transactionService),
      inject: [TransactionService],
    },
  ],
  exports: [
    // Export repository tokens for use by other modules
    SESSION_REPOSITORY,
    USER_REPOSITORY,
    COMPANY_REPOSITORY,
    ROLE_REPOSITORY,
    PERMISSION_REPOSITORY,
    OTP_REPOSITORY,
    REFRESH_TOKEN_REPOSITORY,
    EMAIL_VERIFICATION_REPOSITORY,
    PASSWORD_RESET_REPOSITORY,
    PASSWORD_RESET_ATTEMPT_REPOSITORY,
    COUNTRY_REPOSITORY,
    STATE_REPOSITORY,
    AI_ASSISTANT_REPOSITORY,
    AI_PERSONA_REPOSITORY,
    COMPANY_AI_PERSONA_REPOSITORY,
    COMPANY_AI_ASSISTANT_REPOSITORY,
    COMPANY_SCHEDULES_REPOSITORY,
    AUDIT_LOG_REPOSITORY,
    BOT_TOKEN_REPOSITORY,
    USER_STORAGE_CONFIG_REPOSITORY,
    STORAGE_TIERS_REPOSITORY,
    USER_ACTIVITY_LOG_REPOSITORY,
    DATABASE_HEALTH,
    TOKEN_PROVIDER,
    TRANSACTION_MANAGER,
    RequestCacheService,

    // Export modules for re-use
    PrismaModule,
    LoggerModule,
  ],
})
export class InfrastructureModule {}
