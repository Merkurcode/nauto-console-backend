/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';

// Constants - Only JWT_USER_REPOSITORY is used locally
// Other repository tokens are provided by InfrastructureModule

// JWT-specific token
const JWT_USER_REPOSITORY = 'JWT_USER_REPOSITORY';

// Controllers
import { AuthController } from './auth.controller';

// Special repository for JWT auth
import { UserAuthRepository } from '@infrastructure/repositories/user-auth.repository';
import { LOGGER_SERVICE } from '@shared/constants/tokens';
import { ILogger } from '@core/interfaces/logger.interface';

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
import { I18nModule } from '@infrastructure/i18n/i18n.module';
import { CoreModule } from '@core/core.module';
import { InfrastructureModule } from '@infrastructure/infrastructure.module';

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
import { ChangePasswordCommandHandler } from '@application/commands/auth/change-password.command';
import { ChangeEmailCommandHandler } from '@application/commands/auth/change-email.command';

// Strategies
import { JwtStrategy } from './strategies/jwt.strategy';
import { PrismaService } from '@infrastructure/database/prisma/prisma.service';


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
  ChangePasswordCommandHandler,
  ChangeEmailCommandHandler,
];

@Module({
  imports: [
    CqrsModule,
    I18nModule,
    CoreModule,
    InfrastructureModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('jwt.secret'),
        signOptions: {
          expiresIn: configService.get('jwt.accessExpiration', '15m'),
          algorithm: configService.get('JWT_ALGORITHM', 'HS512'),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    // Services (from CoreModule)
    UserService,
    AuthService,
    CaptchaService,
    InvitationRulesService,

    // JWT-specific repository (not in InfrastructureModule)
    {
      provide: JWT_USER_REPOSITORY,
      useFactory: (prisma: PrismaService, logger: ILogger) =>
        new UserAuthRepository(prisma, logger),
      inject: [PrismaService, { token: LOGGER_SERVICE, optional: true }],
    },
    UserAuthRepository,

    // Validators
    CountryExistsConstraint,
    StateExistsConstraint,
    AgentPhoneUniqueForCompanyConstraint,

    // Strategies
    JwtStrategy,

    // Command handlers
    ...commandHandlers,
  ],
  exports: [UserService, AuthService, JwtStrategy],
})
export class AuthModule {}
