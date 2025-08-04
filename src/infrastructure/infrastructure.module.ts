import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { LoggerService } from './logger/logger.service';
import { CoreModule } from '@core/core.module';
import { LoggerModule } from './logger/logger.module';
import { PrismaModule } from './database/prisma/prisma.module';
import { PrismaService } from './database/prisma/prisma.service';
import { TransactionContextService } from './database/prisma/transaction-context.service';
import { DatabaseHealthProvider } from './database/database-health.provider';

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
import { CompanyAIAssistantRepository } from './repositories/company-ai-assistant.repository';
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
  COMPANY_AI_ASSISTANT_REPOSITORY,
  DATABASE_HEALTH,
  LOGGER_SERVICE,
  TOKEN_PROVIDER,
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
        },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [
    // Repository providers
    {
      provide: SESSION_REPOSITORY,
      useFactory: (prisma: PrismaService, transactionContext: TransactionContextService) =>
        new SessionRepository(prisma, transactionContext),
      inject: [PrismaService, TransactionContextService],
    },
    {
      provide: USER_REPOSITORY,
      useFactory: (prisma: PrismaService, transactionContext: TransactionContextService) =>
        new UserRepository(prisma, transactionContext),
      inject: [PrismaService, TransactionContextService],
    },
    {
      provide: COMPANY_REPOSITORY,
      useFactory: (prisma: PrismaService, transactionContext: TransactionContextService) =>
        new CompanyRepository(prisma, transactionContext),
      inject: [PrismaService, TransactionContextService],
    },
    {
      provide: ROLE_REPOSITORY,
      useFactory: (prisma: PrismaService, transactionContext: TransactionContextService) =>
        new RoleRepository(prisma, transactionContext),
      inject: [PrismaService, TransactionContextService],
    },
    {
      provide: PERMISSION_REPOSITORY,
      useFactory: (prisma: PrismaService, transactionContext: TransactionContextService) =>
        new PermissionRepository(prisma, transactionContext),
      inject: [PrismaService, TransactionContextService],
    },
    {
      provide: OTP_REPOSITORY,
      useFactory: (
        prisma: PrismaService,
        transactionContext: TransactionContextService,
        configService: ConfigService,
      ) => new OtpRepository(prisma, transactionContext, configService),
      inject: [PrismaService, TransactionContextService, ConfigService],
    },
    {
      provide: REFRESH_TOKEN_REPOSITORY,
      useFactory: (
        prisma: PrismaService,
        transactionContext: TransactionContextService,
        configService: ConfigService,
      ) => new RefreshTokenRepository(prisma, transactionContext, configService),
      inject: [PrismaService, TransactionContextService, ConfigService],
    },
    {
      provide: EMAIL_VERIFICATION_REPOSITORY,
      useFactory: (prisma: PrismaService, transactionContext: TransactionContextService) =>
        new EmailVerificationRepository(prisma, transactionContext),
      inject: [PrismaService, TransactionContextService],
    },
    {
      provide: PASSWORD_RESET_REPOSITORY,
      useFactory: (prisma: PrismaService, transactionContext: TransactionContextService) =>
        new PasswordResetRepository(prisma, transactionContext),
      inject: [PrismaService, TransactionContextService],
    },
    {
      provide: PASSWORD_RESET_ATTEMPT_REPOSITORY,
      useFactory: (prisma: PrismaService, transactionContext: TransactionContextService) =>
        new PasswordResetAttemptRepository(prisma, transactionContext),
      inject: [PrismaService, TransactionContextService],
    },
    {
      provide: COUNTRY_REPOSITORY,
      useFactory: (
        prisma: PrismaService,
        transactionContext: TransactionContextService,
        logger: LoggerService,
      ) => new CountryRepository(prisma, transactionContext, logger),
      inject: [PrismaService, TransactionContextService, LoggerService],
    },
    {
      provide: STATE_REPOSITORY,
      useFactory: (
        prisma: PrismaService,
        transactionContext: TransactionContextService,
        logger: LoggerService,
      ) => new StateRepository(prisma, transactionContext, logger),
      inject: [PrismaService, TransactionContextService, LoggerService],
    },
    {
      provide: AI_ASSISTANT_REPOSITORY,
      useFactory: (prisma: PrismaService) => new AIAssistantRepository(prisma),
      inject: [PrismaService],
    },
    {
      provide: COMPANY_AI_ASSISTANT_REPOSITORY,
      useFactory: (prisma: PrismaService) => new CompanyAIAssistantRepository(prisma),
      inject: [PrismaService],
    },

    // Infrastructure services
    {
      provide: DATABASE_HEALTH,
      useFactory: (prisma: PrismaService) => new DatabaseHealthProvider(prisma),
      inject: [PrismaService],
    },
    {
      provide: TOKEN_PROVIDER,
      useClass: TokenProvider,
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
    COMPANY_AI_ASSISTANT_REPOSITORY,
    DATABASE_HEALTH,
    TOKEN_PROVIDER,

    // Export modules for re-use
    PrismaModule,
    LoggerModule,
  ],
})
export class InfrastructureModule {}
