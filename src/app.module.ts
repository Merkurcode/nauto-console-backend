import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Reflector, APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';

// Modules
import { PrismaModule } from '@infrastructure/database/prisma/prisma.module';
import { ThrottlerModule } from '@infrastructure/throttler/throttler.module';
import { I18nModule } from '@infrastructure/i18n/i18n.module';
import { LoggerModule } from '@infrastructure/logger/logger.module';
import { AuthModule } from '@presentation/modules/auth/auth.module';
import { UserModule } from '@presentation/modules/user/user.module';
import { RoleModule } from '@presentation/modules/role/role.module';
import { RootModule } from '@presentation/modules/root/root.module';
import { StorageModule } from '@presentation/modules/storage/storage.module';
import { HealthModule } from '@presentation/modules/health/health.module';
import { CompanyModule } from '@presentation/modules/company/company.module';
import { AIAssistantModule } from '@presentation/modules/ai-assistant/ai-assistant.module';
import { CoreModule } from '@core/core.module';
import { InfrastructureModule } from '@infrastructure/infrastructure.module';

// Global providers
import { LoggingInterceptor } from '@presentation/interceptors/logging.interceptor';
import { TransformInterceptor } from '@presentation/interceptors/transform.interceptor';
import { AllExceptionsFilter } from '@presentation/filters/all-exceptions.filter';
import { DomainExceptionsFilter } from '@presentation/filters/domain-exceptions.filter';
import { JwtAuthGuard } from '@presentation/guards/jwt-auth.guard';
import { UserBanGuard } from '@presentation/guards/user-ban.guard';
import { SessionGuard } from '@presentation/guards/session.guard';
import { UserBanService } from '@core/services/user-ban.service';
import { SessionService } from '@core/services/session.service';
import { ILogger } from '@core/interfaces/logger.interface';
import { LOGGER_SERVICE } from '@shared/constants/tokens';

// Config
import configuration from '@infrastructure/config/configuration';

@Module({
  imports: [
    // Global Config
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: `.env.${process.env.NODE_ENV || 'development'}`,
      load: [configuration],
    }),

    // Logging
    LoggerModule,

    // Database
    PrismaModule,

    // Rate Limiting
    ThrottlerModule,

    // Internationalization
    I18nModule,

    // CQRS
    CqrsModule,

    // JWT Module (Global)
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

    // Feature Modules (AuthModule FIRST for strategy registration)
    AuthModule,

    // Core Domain and Infrastructure
    CoreModule,
    InfrastructureModule,

    // Other Feature Modules
    UserModule,
    RoleModule,
    RootModule,
    StorageModule,
    HealthModule,
    CompanyModule,
    AIAssistantModule,
  ],
  controllers: [],
  providers: [
    // Global interceptors
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },

    // Global filters
    {
      provide: APP_FILTER,
      useClass: DomainExceptionsFilter,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },

    // Global guards (order matters!)
    {
      provide: APP_GUARD,
      useFactory: (reflector: Reflector) => new JwtAuthGuard(reflector),
      inject: [Reflector],
    },
    {
      provide: APP_GUARD,
      useFactory: (userBanService: UserBanService, reflector: Reflector, logger: ILogger) =>
        new UserBanGuard(userBanService, reflector, logger),
      inject: [UserBanService, Reflector, LOGGER_SERVICE],
    },
    {
      provide: APP_GUARD,
      useFactory: (
        sessionService: SessionService,
        reflector: Reflector,
        logger: ILogger,
        jwtService: JwtService,
      ) => new SessionGuard(sessionService, reflector, logger, jwtService),
      inject: [SessionService, Reflector, LOGGER_SERVICE, JwtService],
    },
  ],
})
export class AppModule {}
