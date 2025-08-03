/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';

// Constants
import {
  USER_REPOSITORY,
  ROLE_REPOSITORY,
  OTP_REPOSITORY,
  REFRESH_TOKEN_REPOSITORY,
  EMAIL_VERIFICATION_REPOSITORY,
  PASSWORD_RESET_REPOSITORY,
  PASSWORD_RESET_ATTEMPT_REPOSITORY,
  SESSION_REPOSITORY,
  COMPANY_REPOSITORY,
  COUNTRY_REPOSITORY,
  STATE_REPOSITORY,
} from '@shared/constants/tokens';

// JWT-specific token
const JWT_USER_REPOSITORY = 'JWT_USER_REPOSITORY';

// Controllers
import { AuthController } from './auth.controller';

// Repositories
import { UserRepository } from '@infrastructure/repositories/user.repository';
import { UserAuthRepository } from '@infrastructure/repositories/user-auth.repository';
import { RoleRepository } from '@infrastructure/repositories/role.repository';
import { OtpRepository } from '@infrastructure/repositories/otp.repository';
import { RefreshTokenRepository } from '@infrastructure/repositories/refresh-token.repository';
import { EmailVerificationRepository } from '@infrastructure/repositories/email-verification.repository';
import { PasswordResetRepository } from '@infrastructure/repositories/password-reset.repository';
import { PasswordResetAttemptRepository } from '@infrastructure/repositories/password-reset-attempt.repository';
import { SessionRepository } from '@infrastructure/repositories/session.repository';
import { CompanyRepository } from '@infrastructure/repositories/company.repository';
import { CountryRepository } from '@infrastructure/repositories/country.repository';
import { StateRepository } from '@infrastructure/repositories/state.repository';
import { TokenProvider } from './providers/token.provider';

// Validators
import {
  CountryExistsConstraint,
  StateExistsConstraint,
} from '@shared/validators/country-state.validator';
import { AgentPhoneUniqueForCompanyConstraint } from '@shared/validators/agent-phone.validator';

// Services
import { UserService } from '@core/services/user.service';
import { AuthService } from '@core/services/auth.service';
import { CaptchaService } from '@core/services/captcha.service';
import { InvitationRulesService } from '@core/services/invitation-rules.service';
import { PrismaModule } from '@infrastructure/database/prisma/prisma.module';
import { PrismaService } from '@infrastructure/database/prisma/prisma.service';
import { TransactionContextService } from '@infrastructure/database/prisma/transaction-context.service';
import { I18nModule } from '@infrastructure/i18n/i18n.module';
import { LoggerService } from '@infrastructure/logger/logger.service';
import { CoreModule } from '@core/core.module';

// Command Handlers
import { RegisterUserCommandHandler } from '@application/commands/auth/register-user.command';
import { LoginCommandHandler } from '@application/commands/auth/login.command';
import { VerifyOtpCommandHandler } from '@application/commands/auth/verify-otp.command';
import { RefreshTokenCommandHandler } from '@application/commands/auth/refresh-token.command';
import { LogoutCommandHandler } from '@application/commands/auth/logout.command';
import { SendVerificationEmailCommandHandler } from '@application/commands/auth/send-verification-email.command';
import { VerifyEmailCommandHandler } from '@application/commands/auth/verify-email.command';
import { CheckEmailVerificationStatusCommandHandler } from '@application/commands/auth/check-email-verification-status.command';
import { RequestPasswordResetCommandHandler } from '@application/commands/auth/request-password-reset.command';
import { ResetPasswordCommandHandler } from '@application/commands/auth/reset-password.command';
import { AdminChangePasswordCommandHandler } from '@application/commands/auth/admin-change-password.command';

// Strategies
import { JwtStrategy } from './strategies/jwt.strategy';


const commandHandlers = [
  RegisterUserCommandHandler,
  LoginCommandHandler,
  VerifyOtpCommandHandler,
  RefreshTokenCommandHandler,
  LogoutCommandHandler,
  SendVerificationEmailCommandHandler,
  VerifyEmailCommandHandler,
  CheckEmailVerificationStatusCommandHandler,
  RequestPasswordResetCommandHandler,
  ResetPasswordCommandHandler,
  AdminChangePasswordCommandHandler,
];

@Module({
  imports: [
    CqrsModule,
    PrismaModule,
    I18nModule,
    CoreModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('jwt.secret'),
        signOptions: {
          expiresIn: configService.get('jwt.accessExpiration', '15m'),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    // Services
    UserService,
    AuthService,
    CaptchaService,
    InvitationRulesService,

    // Repository tokens
    {
      provide: USER_REPOSITORY,
      useFactory: (prisma: PrismaService, transactionContext: TransactionContextService) => 
        new UserRepository(prisma, transactionContext),
      inject: [PrismaService, TransactionContextService],
    },
    {
      provide: JWT_USER_REPOSITORY,
      useClass: UserAuthRepository,
    },
    {
      provide: ROLE_REPOSITORY,
      useFactory: (prisma: PrismaService, transactionContext: TransactionContextService) => 
        new RoleRepository(prisma, transactionContext),
      inject: [PrismaService, TransactionContextService],
    },
    {
      provide: OTP_REPOSITORY,
      useFactory: (prisma: PrismaService, transactionContext: TransactionContextService, configService: ConfigService) => 
        new OtpRepository(prisma, transactionContext, configService),
      inject: [PrismaService, TransactionContextService, ConfigService],
    },
    {
      provide: REFRESH_TOKEN_REPOSITORY,
      useFactory: (prisma: PrismaService, transactionContext: TransactionContextService, configService: ConfigService) => 
        new RefreshTokenRepository(prisma, transactionContext, configService),
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
      provide: SESSION_REPOSITORY,
      useFactory: (prisma: PrismaService, transactionContext: TransactionContextService) => 
        new SessionRepository(prisma, transactionContext),
      inject: [PrismaService, TransactionContextService],
    },
    {
      provide: COMPANY_REPOSITORY,
      useFactory: (prisma: PrismaService, transactionContext: TransactionContextService) => 
        new CompanyRepository(prisma, transactionContext),
      inject: [PrismaService, TransactionContextService],
    },
    {
      provide: COUNTRY_REPOSITORY,
      useFactory: (prisma: PrismaService, transactionContext: TransactionContextService, logger: LoggerService) => 
        new CountryRepository(prisma, transactionContext, logger),
      inject: [PrismaService, TransactionContextService, LoggerService],
    },
    {
      provide: STATE_REPOSITORY,
      useFactory: (prisma: PrismaService, transactionContext: TransactionContextService, logger: LoggerService) => 
        new StateRepository(prisma, transactionContext, logger),
      inject: [PrismaService, TransactionContextService, LoggerService],
    },

    // Validators
    CountryExistsConstraint,
    StateExistsConstraint,
    AgentPhoneUniqueForCompanyConstraint,

    // Providers
    TokenProvider,

    // Strategies
    JwtStrategy,

    // Command handlers
    ...commandHandlers,
  ],
  exports: [UserService, AuthService, JwtStrategy],
})
export class AuthModule {}
